import { audioCtx, emitter, env, noiseSource, out, ready, replaceSlot, type Emitter } from './engine'
import { active } from '../districts/active'

// Stylized Bengaluru soundscape (sounddesign.md §2, §4, §20).
// Synthesized, placed in the world. Rule: nothing audible without a visible
// source — except the distant city bed and far-off horns (off-screen city).

export const emitters: Emitter[] = []
let started = ''
let gen = 0
let root: GainNode
let bag: AudioScheduledSourceNode[] = []
const track = <T extends AudioScheduledSourceNode>(s: T) => (bag.push(s), s)

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/** Repeat `fn` at random intervals while audio runs. */
function every(min: number, max: number, fn: () => void, first = rand(min, max)) {
  const mine = gen
  const loop = () => {
    if (mine !== gen) return // this district's soundscape was torn down
    if (ready()) fn()
    setTimeout(loop, rand(min, max) * 1000)
  }
  setTimeout(loop, first * 1000)
}

// --- the city bed (non-positional) ----------------------------------------------

function cityBed() {
  const c = audioCtx()!
  const rumble = noiseSource('brown')
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 320
  const g = c.createGain()
  g.gain.value = 0.09
  rumble.connect(lp).connect(g).connect(root)
  // slow swell — traffic breathing in the distance
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.06
  const depth = c.createGain()
  depth.gain.value = 0.03
  lfo.connect(depth).connect(g.gain)
  track(lfo).start()
  track(rumble).start()

  const air = noiseSource('pink')
  const hp = c.createBiquadFilter()
  hp.type = 'bandpass'
  hp.frequency.value = 900
  hp.Q.value = 0.4
  const ag = c.createGain()
  ag.gain.value = 0.018
  air.connect(hp).connect(ag).connect(root)
  track(air).start()
}

/** Far-off Bengaluru horns — single and the classic double beep. */
function horn() {
  const c = audioCtx()!
  const a = Math.random() * Math.PI * 2
  const d = rand(45, 80)
  const to = place(Math.cos(a) * d, 2, Math.sin(a) * d, 14).input
  setTimeout(() => to.disconnect(), 3000)
  const t = c.currentTime
  const pitch = pick([380, 440, 520, 610])
  const beeps = Math.random() < 0.45 ? 2 : 1
  for (let b = 0; b < beeps; b++) {
    const tb = t + b * 0.24
    const len = beeps === 2 ? 0.14 : rand(0.22, 0.5)
    const g = c.createGain()
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = pitch * 2.2
    bp.Q.value = 1.2
    for (const r of [1, 1.26]) {
      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.value = pitch * r
      o.connect(bp)
      o.start(tb)
      o.stop(tb + len + 0.05)
    }
    bp.connect(g).connect(to)
    g.gain.setValueAtTime(0.0001, tb)
    g.gain.linearRampToValueAtTime(0.09, tb + 0.015)
    g.gain.setValueAtTime(0.09, tb + len - 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, tb + len)
  }
}

// --- the park --------------------------------------------------------------------

function chirp(to: AudioNode) {
  const c = audioCtx()!
  const t = c.currentTime
  const n = Math.floor(rand(2, 6))
  const base = rand(2800, 4600)
  for (let i = 0; i < n; i++) {
    const tt = t + i * rand(0.07, 0.13)
    const o = c.createOscillator()
    o.frequency.setValueAtTime(base, tt)
    o.frequency.exponentialRampToValueAtTime(base * rand(1.2, 1.6), tt + 0.04)
    o.frequency.exponentialRampToValueAtTime(base * 0.9, tt + 0.07)
    const g = c.createGain()
    o.connect(g).connect(to)
    env(g.gain, tt, 0.05, 0.005, 0.07)
    o.start(tt)
    o.stop(tt + 0.1)
  }
}

/** The Asian koel — "ku-OO" calls climbing in pitch. The sound of a Bengaluru summer. */
function koel(to: AudioNode) {
  const c = audioCtx()!
  const t0 = c.currentTime
  const calls = Math.floor(rand(3, 6))
  let base = rand(560, 640)
  for (let i = 0; i < calls; i++) {
    const t = t0 + i * 0.9
    const o = c.createOscillator()
    o.frequency.setValueAtTime(base * 0.86, t)
    o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.12)
    o.frequency.setValueAtTime(base * 1.06, t + 0.2)
    o.frequency.exponentialRampToValueAtTime(base * 1.22, t + 0.5)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.06, t + 0.03)
    g.gain.linearRampToValueAtTime(0.012, t + 0.14)
    g.gain.linearRampToValueAtTime(0.07, t + 0.24)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.58)
    o.connect(g).connect(to)
    o.start(t)
    o.stop(t + 0.6)
    base *= 1.07
  }
}

function crow(to: AudioNode) {
  const c = audioCtx()!
  const t0 = c.currentTime
  const n = Math.floor(rand(1, 4))
  for (let i = 0; i < n; i++) {
    const t = t0 + i * rand(0.35, 0.5)
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(rand(520, 600), t)
    o.frequency.exponentialRampToValueAtTime(380, t + 0.26)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1300
    bp.Q.value = 3
    const g = c.createGain()
    o.connect(bp).connect(g).connect(to)
    env(g.gain, t, 0.05, 0.02, 0.26)
    o.start(t)
    o.stop(t + 0.3)
  }
}

function park() {
  const trees = active.def.trees.map((t) => place(t.x, 6, t.z, 4, 1.2))
  if (!trees.length) return
  emitters.push(...trees)
  const c = audioCtx()!
  // leaves: gusty rustle from the big rain tree
  const rustle = noiseSource('pink')
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2600
  const rg = c.createGain()
  rg.gain.value = 0.02
  const gust = c.createOscillator()
  gust.frequency.value = 0.09
  const gd = c.createGain()
  gd.gain.value = 0.016
  gust.connect(gd).connect(rg.gain)
  track(gust).start()
  rustle.connect(hp).connect(rg).connect(trees[0].input)
  track(rustle).start()

  every(1.2, 5, () => chirp(pick(trees).input))
  every(22, 45, () => koel(trees[0].input), 6)
  every(14, 32, () => crow(pick(trees).input), 9)
}

/** An emitter routed through this module's root, so it can be torn down. */
function place(x: number, y: number, z: number, ref: number, rolloff = 1.4) {
  const e = emitter(x, y, z, 'ambience', ref, rolloff)
  e.panner.disconnect()
  e.panner.connect(root)
  return e
}

/** Build the soundscape for the loaded district (re-run on travel — tears the old one down). */
/** The portal's low, warm hum — you hear it before you see it. */
function portalHum() {
  const c = audioCtx()!
  const p = active.def.portal
  const e = place(p.x, 2.5, p.z, 3, 1.5)
  const g = c.createGain()
  g.gain.value = 0.05
  for (const [f, d] of [
    [110, 0],
    [165, 4],
    [220.5, -3],
  ] as const) {
    const o = track(c.createOscillator())
    o.frequency.value = f
    o.detune.value = d
    o.connect(g)
    o.start()
  }
  const lfo = track(c.createOscillator())
  lfo.frequency.value = 0.6
  const ld = c.createGain()
  ld.gain.value = 0.02
  lfo.connect(ld).connect(g.gain)
  lfo.start()
  g.connect(e.input)
}

export function startAmbience() {
  const c = audioCtx()
  if (!c || started === active.def.id) return
  started = active.def.id
  gen++ // stops the old district's timers
  const myBag: AudioScheduledSourceNode[] = (bag = [])
  const myRoot = (root = c.createGain())
  myRoot.gain.value = 0
  myRoot.gain.setTargetAtTime(1, c.currentTime, 0.8) // fade in, no hard cut (sounddesign.md §16)
  myRoot.connect(out('ambience'))
  // disposes the PREVIOUS district's soundscape, then registers this one's
  replaceSlot('ambience', () => {
    for (const s of myBag) {
      try {
        s.stop()
      } catch {
        // already stopped
      }
    }
    myRoot.disconnect()
  })
  emitters.length = 0
  cityBed()
  park()
  portalHum()
  every(7, 18, horn, 3)
}
