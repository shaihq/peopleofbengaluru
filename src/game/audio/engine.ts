import { create } from 'zustand'

// Audio engine (sounddesign.md §13 hierarchy → buses).
//
//   ambience ─┐
//   sfx ──────┼─ world ── muffle(lowpass) ─┐
//   music ── duck ─────────────────────────┼─ master ── limiter ── out
//   ui ────────────────────────────────────┘
//
// Everything is synthesized or CC0 (see public/audio/CREDITS.md).

type Settings = { master: number; music: number; sfx: number; muted: boolean }
const KEY = 'dob.audio'

function loadSettings(): Settings {
  const d = { master: 0.8, music: 0.6, sfx: 0.8, muted: false }
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return d
  }
}

export const useAudio = create<Settings & { set: (p: Partial<Settings>) => void }>((set, get) => ({
  ...(typeof window === 'undefined' ? { master: 0.8, music: 0.6, sfx: 0.8, muted: false } : loadSettings()),
  set: (p) => {
    set(p)
    const { master, music, sfx, muted } = get()
    try {
      localStorage.setItem(KEY, JSON.stringify({ master, music, sfx, muted }))
    } catch {
      // non-critical
    }
    applyLevels()
  },
}))

export type Bus = 'ambience' | 'sfx' | 'music' | 'ui'

let ctx: AudioContext | null = null
const nodes = {} as {
  master: GainNode
  limiter: DynamicsCompressorNode
  world: GainNode
  muffle: BiquadFilterNode
  musicDuck: GainNode
  buses: Record<Bus, GainNode>
}

export const audioCtx = () => ctx
export const ready = () => !!ctx && ctx.state === 'running'

function build(c: AudioContext) {
  nodes.limiter = c.createDynamicsCompressor()
  nodes.limiter.threshold.value = -10
  nodes.limiter.knee.value = 6
  nodes.limiter.ratio.value = 8
  nodes.limiter.attack.value = 0.003
  nodes.limiter.release.value = 0.2
  nodes.limiter.connect(c.destination)
  nodes.master = c.createGain()
  nodes.master.connect(nodes.limiter)

  nodes.muffle = c.createBiquadFilter()
  nodes.muffle.type = 'lowpass'
  nodes.muffle.frequency.value = 20000
  nodes.muffle.Q.value = 0.5
  nodes.muffle.connect(nodes.master)
  nodes.world = c.createGain()
  nodes.world.connect(nodes.muffle)

  nodes.musicDuck = c.createGain()
  nodes.musicDuck.connect(nodes.master)

  const mk = (to: AudioNode) => {
    const g = c.createGain()
    g.connect(to)
    return g
  }
  nodes.buses = {
    ambience: mk(nodes.world),
    sfx: mk(nodes.world),
    music: mk(nodes.musicDuck),
    ui: mk(nodes.master),
  }
  applyLevels()
}

function applyLevels() {
  if (!ctx) return
  const { master, music, sfx, muted } = useAudio.getState()
  const t = ctx.currentTime
  nodes.master.gain.setTargetAtTime(muted ? 0 : master, t, 0.05)
  nodes.buses.music.gain.setTargetAtTime(music * 0.55, t, 0.05)
  nodes.buses.sfx.gain.setTargetAtTime(sfx, t, 0.05)
  nodes.buses.ambience.gain.setTargetAtTime(sfx * 0.9, t, 0.05)
  nodes.buses.ui.gain.setTargetAtTime(sfx * 0.85, t, 0.05)
}

const listeners: (() => void)[] = []
/** Run once the context exists and is running (after the first user gesture). */
export function onReady(fn: () => void) {
  if (ready()) fn()
  else listeners.push(fn)
}

/** Browsers only allow audio after a user gesture — call from any click/keypress. */
export async function unlock() {
  if (typeof window === 'undefined') return
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' })
    const mine = ctx
    replaceSlot('ctx', () => mine.close()) // dev hot-reload: silence the previous context
    build(ctx)
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return
      if (document.hidden) ctx.suspend()
      else ctx.resume()
    })
  }
  if (ctx.state !== 'running') await ctx.resume().catch(() => {})
  if (ctx.state === 'running') while (listeners.length) listeners.shift()!()
}

export const out = (bus: Bus) => nodes.buses[bus]

/**
 * Hot-reload safety: a module that builds long-running audio registers a
 * disposer under a key. When that module is re-evaluated (dev HMR), the old
 * graph is torn down first — otherwise removed sounds keep playing.
 */
export function replaceSlot(key: string, dispose: () => void) {
  const w = window as unknown as { __dobSlots?: Record<string, () => void> }
  w.__dobSlots ??= {}
  try {
    w.__dobSlots[key]?.()
  } catch {
    // old graph already gone
  }
  w.__dobSlots[key] = dispose
}

/** Muffle the world (menus, pause) — UI stays crisp. */
export function setMuffle(amount: number) {
  if (!ctx) return
  const f = amount <= 0 ? 20000 : 20000 * Math.pow(600 / 20000, amount)
  nodes.muffle.frequency.setTargetAtTime(f, ctx.currentTime, 0.12)
  nodes.world.gain.setTargetAtTime(1 - amount * 0.35, ctx.currentTime, 0.12)
}

/** Dip the music under a stinger. */
export function duckMusic(depth = 0.35, hold = 1.2) {
  if (!ctx) return
  const g = nodes.musicDuck.gain
  const t = ctx.currentTime
  g.cancelScheduledValues(t)
  g.setValueAtTime(g.value, t)
  g.linearRampToValueAtTime(depth, t + 0.06)
  g.setValueAtTime(depth, t + hold)
  g.linearRampToValueAtTime(1, t + hold + 0.8)
}

export function setMusicLevel(v: number, time = 1.5) {
  if (!ctx) return
  nodes.musicDuck.gain.setTargetAtTime(v, ctx.currentTime, time / 3)
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const noiseCache = new Map<string, AudioBuffer>()
/** 4s looping noise buffers: white, pink, brown. */
export function noise(kind: 'white' | 'pink' | 'brown' = 'white') {
  let b = noiseCache.get(kind)
  if (b || !ctx) return b!
  const len = ctx.sampleRate * 4
  b = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = b.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') d[i] = w
    else if (kind === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2
    } else {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    }
  }
  noiseCache.set(kind, b)
  return b
}

export function noiseSource(kind: 'white' | 'pink' | 'brown', loop = true) {
  const s = ctx!.createBufferSource()
  s.buffer = noise(kind)
  s.loop = loop
  if (loop) s.loopStart = Math.random() * 3
  return s
}

/** Attack/decay envelope on a gain param. */
export function env(p: AudioParam, t: number, peak: number, attack: number, decay: number, from = 0.0001) {
  p.cancelScheduledValues(t)
  p.setValueAtTime(from, t)
  p.linearRampToValueAtTime(peak, t + attack)
  p.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

// ---------------------------------------------------------------------------
// Samples (CC0, public/audio/sfx)
// ---------------------------------------------------------------------------

const samples = new Map<string, AudioBuffer>()
const pending = new Map<string, Promise<AudioBuffer | null>>()

export function loadSample(name: string) {
  if (samples.has(name)) return Promise.resolve(samples.get(name)!)
  let p = pending.get(name)
  if (!p && ctx) {
    p = fetch(`/audio/sfx/${name}.m4a`)
      .then((r) => r.arrayBuffer())
      .then((a) => ctx!.decodeAudioData(a))
      .then((b) => (samples.set(name, b), b))
      .catch(() => null)
    pending.set(name, p)
  }
  return p ?? Promise.resolve(null)
}

export function playSample(name: string, opts: { bus?: Bus; rate?: number; gain?: number; at?: AudioNode; when?: number } = {}) {
  if (!ctx) return
  const buf = samples.get(name)
  if (!buf) {
    loadSample(name)
    return
  }
  const s = ctx.createBufferSource()
  s.buffer = buf
  s.playbackRate.value = opts.rate ?? 1
  const g = ctx.createGain()
  g.gain.value = opts.gain ?? 1
  s.connect(g).connect(opts.at ?? out(opts.bus ?? 'sfx'))
  s.start(opts.when ?? ctx.currentTime)
}

// ---------------------------------------------------------------------------
// Spatial
// ---------------------------------------------------------------------------

export type Emitter = { panner: PannerNode; occl: BiquadFilterNode; input: GainNode; x: number; y: number; z: number }

/** A point in the world that sounds come from (with an occlusion filter in front of it). */
export function emitter(x: number, y: number, z: number, bus: Bus = 'ambience', ref = 4, rolloff = 1.2): Emitter {
  const c = ctx!
  const panner = c.createPanner()
  panner.panningModel = 'HRTF'
  panner.distanceModel = 'inverse'
  panner.refDistance = ref
  panner.rolloffFactor = rolloff
  panner.maxDistance = 200
  panner.positionX.value = x
  panner.positionY.value = y
  panner.positionZ.value = z
  const occl = c.createBiquadFilter()
  occl.type = 'lowpass'
  occl.frequency.value = 20000
  const input = c.createGain()
  input.connect(occl).connect(panner).connect(out(bus))
  return { panner, occl, input, x, y, z }
}

export function moveEmitter(e: Emitter, x: number, y: number, z: number) {
  if (!ctx) return
  const t = ctx.currentTime
  e.x = x
  e.y = y
  e.z = z
  e.panner.positionX.setTargetAtTime(x, t, 0.05)
  e.panner.positionY.setTargetAtTime(y, t, 0.05)
  e.panner.positionZ.setTargetAtTime(z, t, 0.05)
}

/** One-shot positional voice: returns a node to connect a sound into; cleans itself up. */
export function at(x: number, y: number, z: number, bus: Bus = 'sfx', ref = 3) {
  const e = emitter(x, y, z, bus, ref, 1.4)
  setTimeout(() => e.panner.disconnect(), 6000)
  return e.input
}

export function setListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number) {
  if (!ctx) return
  const l = ctx.listener
  const t = ctx.currentTime
  if (l.positionX) {
    l.positionX.setTargetAtTime(px, t, 0.02)
    l.positionY.setTargetAtTime(py, t, 0.02)
    l.positionZ.setTargetAtTime(pz, t, 0.02)
    l.forwardX.setTargetAtTime(fx, t, 0.02)
    l.forwardY.setTargetAtTime(fy, t, 0.02)
    l.forwardZ.setTargetAtTime(fz, t, 0.02)
    l.upX.value = 0
    l.upY.value = 1
    l.upZ.value = 0
  } else {
    l.setPosition(px, py, pz)
    l.setOrientation(fx, fy, fz, 0, 1, 0)
  }
}

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(window as unknown as { __audio?: unknown }).__audio = { ctx: () => ctx, nodes }
}
