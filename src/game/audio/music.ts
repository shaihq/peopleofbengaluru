import { audioCtx, emitter, moveEmitter, mtof, noise, out, replaceSlot, type Emitter } from './engine'
import { active } from '../districts/active'
import { MOTIF } from './sfx'

// Generative lofi hip-hop, synthesized live — 100% original, no samples, no
// licences. Boom-bap drums with swing, jazzy keys with tape wobble, sub bass,
// vinyl crackle and the odd record-scratch fill. The melody keeps quoting the
// game's motif, so music and UI feel like one score (sounddesign.md §14–15, §22).
//
// Modes:  title   — full beat (intro screen)
//         create  — no kick/snare, soft rim + keys (become visible)
//         explore — the beat leaks from the darshini's radio; the street stays
//                   mostly city sound, with sparse quiet keys (§20 silence matters)

export type MusicMode = 'off' | 'title' | 'create' | 'explore'

const BPM = 84
const S16 = 60 / BPM / 4
const SWING = 0.17

type Chord = { root: number; notes: number[] }
const PROGRESSIONS: Chord[][] = [
  [
    { root: 43, notes: [59, 62, 66, 69] }, // Gmaj9
    { root: 42, notes: [57, 61, 64, 69] }, // F#m7
    { root: 40, notes: [55, 59, 62, 66] }, // Em9
    { root: 45, notes: [62, 64, 67, 71] }, // A13sus
  ],
  [
    { root: 47, notes: [57, 61, 62, 66] }, // Bm9
    { root: 43, notes: [59, 62, 66, 69] }, // Gmaj9
    { root: 40, notes: [55, 59, 62, 66] }, // Em9
    { root: 38, notes: [57, 61, 64, 66] }, // Dmaj9
  ],
]
const PENTA = [74, 76, 78, 81, 83, 86, 88]

const KICK = [1, 0, 0, 0, 0, 0, 0, 0.55, 0, 0, 1, 0, 0, 0, 0, 0]
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.25]
const HAT = [0.8, 0, 0.45, 0.2, 0.75, 0, 0.45, 0.25, 0.8, 0, 0.45, 0.2, 0.75, 0, 0.5, 0.3]

let mode: MusicMode = 'off'
let timer: ReturnType<typeof setInterval> | null = null
let next = 0
let step = 0 // 16th index since start
const g = {} as {
  mix: GainNode
  global: GainNode
  radio: GainNode
  radioEm: Emitter
  drums: GainNode
  keys: GainNode
  keysLp: BiquadFilterNode
  bass: GainNode
  mel: GainNode
  crackle: GainNode
}
let built = false

function build() {
  const c = audioCtx()!
  g.mix = c.createGain()
  g.global = c.createGain()
  g.mix.connect(g.global).connect(out('music'))

  // The darshini radio: the same beat, gently band-limited (clean — no distortion), placed in the world.
  const [rx, ry, rz] = active.def.radio ?? [0, -50, 0]
  g.radioEm = emitter(rx, ry, rz, 'music', 6, 1.6)
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 160
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 6000
  g.radio = c.createGain()
  g.radio.gain.value = 0
  g.mix.connect(hp).connect(lp).connect(g.radio).connect(g.radioEm.input)

  // lofi tone: everything through a warm lowpass + soft saturation
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 5200
  tone.connect(g.mix)
  const sum = c.createGain()
  sum.connect(tone)

  g.drums = c.createGain()
  g.drums.connect(sum)
  g.keysLp = c.createBiquadFilter()
  g.keysLp.type = 'lowpass'
  g.keysLp.frequency.value = 2100
  g.keys = c.createGain()
  g.keys.connect(g.keysLp).connect(sum)
  // gentle tremolo on the keys
  const trem = c.createOscillator()
  trem.frequency.value = 4.2
  const tremDepth = c.createGain()
  tremDepth.gain.value = 0.12
  trem.connect(tremDepth).connect(g.keys.gain)
  trem.start()
  g.bass = c.createGain()
  g.bass.connect(sum)
  g.mel = c.createGain()
  g.mel.connect(sum)

  // vinyl crackle: sparse pops over a soft hiss
  const len = c.sampleRate * 3
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * 0.012
    if (Math.random() < 0.00035) d[i] += (Math.random() * 2 - 1) * 0.9
  }
  const cr = c.createBufferSource()
  cr.buffer = buf
  cr.loop = true
  const crHp = c.createBiquadFilter()
  crHp.type = 'highpass'
  crHp.frequency.value = 900
  g.crackle = c.createGain()
  g.crackle.gain.value = 0
  cr.connect(crHp).connect(g.crackle).connect(g.mix)
  cr.start()
  built = true
  replaceSlot('music', () => {
    if (timer) clearInterval(timer)
    timer = null
    mode = 'off'
    try {
      cr.stop()
      trem.stop()
    } catch {
      // already stopped
    }
    g.mix.disconnect()
    g.radioEm.panner.disconnect()
  })
}

// --- voices --------------------------------------------------------------------

const wobble = (t: number) => Math.sin(t * Math.PI * 2 * 0.31) * 9 + Math.sin(t * Math.PI * 2 * 0.07) * 6

function kick(t: number, v: number) {
  const c = audioCtx()!
  const o = c.createOscillator()
  o.frequency.setValueAtTime(130, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13)
  const a = c.createGain()
  o.connect(a).connect(g.drums)
  a.gain.setValueAtTime(0.0001, t)
  a.gain.linearRampToValueAtTime(0.95 * v, t + 0.004)
  a.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
  o.start(t)
  o.stop(t + 0.45)
}

function snare(t: number, v: number, rim = false) {
  const c = audioCtx()!
  const n = c.createBufferSource()
  n.buffer = noise('white')
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = rim ? 2600 : 1700
  bp.Q.value = rim ? 3 : 0.8
  const a = c.createGain()
  n.connect(bp).connect(a).connect(g.drums)
  const len = rim ? 0.05 : 0.17
  a.gain.setValueAtTime(0.0001, t)
  a.gain.linearRampToValueAtTime((rim ? 0.25 : 0.42) * v, t + 0.003)
  a.gain.exponentialRampToValueAtTime(0.0001, t + len)
  n.start(t, Math.random() * 3)
  n.stop(t + len + 0.02)
  if (!rim) {
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(200, t)
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08)
    const b = c.createGain()
    o.connect(b).connect(g.drums)
    b.gain.setValueAtTime(0.0001, t)
    b.gain.linearRampToValueAtTime(0.28 * v, t + 0.003)
    b.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    o.start(t)
    o.stop(t + 0.12)
  }
}

function hat(t: number, v: number, open = false) {
  const c = audioCtx()!
  const n = c.createBufferSource()
  n.buffer = noise('white')
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7200
  const a = c.createGain()
  n.connect(hp).connect(a).connect(g.drums)
  const len = open ? 0.16 : 0.035
  a.gain.setValueAtTime(0.0001, t)
  a.gain.linearRampToValueAtTime(0.11 * v, t + 0.002)
  a.gain.exponentialRampToValueAtTime(0.0001, t + len)
  n.start(t, Math.random() * 3)
  n.stop(t + len + 0.02)
}

/** Electric-piano-ish note: sine body + soft octave + quick "tine" FM at the attack. */
function key(t: number, midi: number, v: number, len: number) {
  const c = audioCtx()!
  const f = mtof(midi)
  const det = wobble(t)
  const body = c.createOscillator()
  body.frequency.value = f
  body.detune.value = det
  const oct = c.createOscillator()
  oct.frequency.value = f * 2
  oct.detune.value = det
  const og = c.createGain()
  og.gain.value = 0.18
  const tine = c.createOscillator()
  tine.frequency.value = f * 7
  const tg = c.createGain()
  tg.gain.setValueAtTime(f * 0.9, t)
  tg.gain.exponentialRampToValueAtTime(1, t + 0.12)
  tine.connect(tg).connect(body.frequency)
  const a = c.createGain()
  body.connect(a)
  oct.connect(og).connect(a)
  a.connect(g.keys)
  a.gain.setValueAtTime(0.0001, t)
  a.gain.linearRampToValueAtTime(0.085 * v, t + 0.012)
  a.gain.exponentialRampToValueAtTime(0.03 * v, t + 0.6)
  a.gain.exponentialRampToValueAtTime(0.0001, t + len)
  for (const o of [body, oct, tine]) {
    o.start(t)
    o.stop(t + len + 0.05)
  }
}

function bassNote(t: number, midi: number, v: number, len: number) {
  const c = audioCtx()!
  const o = c.createOscillator()
  o.type = 'triangle'
  o.frequency.value = mtof(midi)
  o.detune.value = wobble(t) * 0.5
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  const a = c.createGain()
  o.connect(lp).connect(a).connect(g.bass)
  a.gain.setValueAtTime(0.0001, t)
  a.gain.linearRampToValueAtTime(0.5 * v, t + 0.02)
  a.gain.exponentialRampToValueAtTime(0.18 * v, t + len * 0.7)
  a.gain.exponentialRampToValueAtTime(0.0001, t + len)
  o.start(t)
  o.stop(t + len + 0.05)
}

/** Soft mallet/kalimba pluck for the melody. */
function mel(t: number, midi: number, v: number) {
  const c = audioCtx()!
  const f = mtof(midi)
  const a = c.createOscillator()
  a.frequency.value = f
  a.detune.value = wobble(t)
  const b = c.createOscillator()
  b.frequency.value = f * 3.01
  const bg = c.createGain()
  bg.gain.value = 0.12
  const env = c.createGain()
  a.connect(env)
  b.connect(bg).connect(env)
  env.connect(g.mel)
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(0.09 * v, t + 0.006)
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
  a.start(t)
  b.start(t)
  a.stop(t + 0.95)
  b.stop(t + 0.95)
}

/** "Wikka-wikka" record scratch fill. */
function scratch(t: number) {
  const c = audioCtx()!
  const o = c.createOscillator()
  o.type = 'sawtooth'
  const pts: [number, number][] = [
    [0, 280],
    [0.07, 900],
    [0.12, 260],
    [0.19, 820],
    [0.26, 240],
  ]
  pts.forEach(([dt, f], i) => (i === 0 ? o.frequency.setValueAtTime(f, t) : o.frequency.linearRampToValueAtTime(f, t + dt)))
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1100
  bp.Q.value = 1.6
  const a = c.createGain()
  o.connect(bp).connect(a).connect(g.drums)
  a.gain.setValueAtTime(0.0001, t)
  ;[0, 0.07, 0.12, 0.19].forEach((dt, i) => {
    a.gain.linearRampToValueAtTime(i % 2 ? 0.05 : 0.11, t + dt + 0.02)
    a.gain.linearRampToValueAtTime(0.01, t + dt + 0.055)
  })
  a.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
  o.start(t)
  o.stop(t + 0.32)
}

// --- arrangement ---------------------------------------------------------------

let prog = 0
let motifCycle = 0
let lastMel = -1

function scheduleStep(i: number, t: number) {
  const s = i % 16
  const bar = Math.floor(i / 16)
  const chordIdx = bar % 4
  if (s === 0 && chordIdx === 0 && bar > 0) {
    prog = (prog + (Math.random() < 0.4 ? 1 : 0)) % PROGRESSIONS.length
    motifCycle++
  }
  const chord = PROGRESSIONS[prog][chordIdx]
  const full = mode === 'title'
  const create = mode === 'create'
  const explore = mode === 'explore'
  const tt = t + (s % 2 === 1 ? SWING * S16 : 0) + (Math.random() - 0.5) * 0.006

  // drums
  if (full || explore) {
    if (KICK[s] && (KICK[s] === 1 || Math.random() < KICK[s])) kick(tt, 1)
    if (SNARE[s] && (SNARE[s] === 1 || Math.random() < SNARE[s])) snare(tt, SNARE[s] === 1 ? 1 : 0.35)
  }
  if (create && (s === 4 || s === 12)) snare(tt, 0.7, true)
  if (HAT[s] && (full || explore || (create && s % 4 === 2))) {
    const open = s === 14 && Math.random() < 0.3
    hat(tt, HAT[s] * (0.75 + Math.random() * 0.4) * (create ? 0.6 : 1), open)
  }
  if (full && s === 13 && bar % 8 === 7 && Math.random() < 0.6) scratch(tt)

  // keys: strummed chord on the 1, a soft re-hit on the "and" of 3 sometimes
  if (s === 0) chord.notes.forEach((n, k) => key(t + k * 0.018, n, 1, S16 * 15))
  if (s === 10 && Math.random() < 0.45) chord.notes.slice(1).forEach((n, k) => key(tt + k * 0.014, n, 0.55, S16 * 6))

  // bass
  if (!create || s === 0) {
    if (s === 0) bassNote(t, chord.root, 1, S16 * 7)
    if (s === 7 && (full || explore)) bassNote(tt, chord.root, 0.6, S16 * 2.5)
    if (s === 10 && (full || explore) && Math.random() < 0.7) bassNote(tt, chord.root + (Math.random() < 0.5 ? 7 : 12), 0.7, S16 * 5)
  }

  // melody: the motif on the first bar of every 4th cycle, otherwise sparse pentatonic noodling
  if (s % 2 === 0) {
    if (motifCycle % 4 === 1 && chordIdx === 0 && s <= 6) {
      mel(tt, MOTIF[s / 2], 1)
      lastMel = MOTIF[s / 2]
    } else {
      const p = full ? 0.22 : create ? 0.14 : 0.1
      if (Math.random() < p) {
        const near = PENTA.filter((n) => lastMel < 0 || Math.abs(n - lastMel) <= 5)
        const n = near[Math.floor(Math.random() * near.length)]
        mel(tt, n, 0.6 + Math.random() * 0.4)
        lastMel = n
      }
    }
  }
}

function tick() {
  const c = audioCtx()
  if (!c || mode === 'off') return
  if (next < c.currentTime - 0.2) next = c.currentTime + 0.05
  while (next < c.currentTime + 0.15) {
    scheduleStep(step, next)
    next += S16
    step++
  }
}

const LEVELS: Record<MusicMode, { global: number; radio: number; crackle: number; drums: number }> = {
  off: { global: 0, radio: 0, crackle: 0, drums: 1 },
  title: { global: 1, radio: 0, crackle: 0.9, drums: 1 },
  create: { global: 0.75, radio: 0, crackle: 0.6, drums: 0.8 },
  explore: { global: 0.08, radio: 1.5, crackle: 0, drums: 1 },
}

export function setMusicMode(m: MusicMode) {
  const c = audioCtx()
  if (!c || m === mode) return
  if (!built) build()
  const was = mode
  mode = m
  const L = LEVELS[m]
  const t = c.currentTime
  g.global.gain.setTargetAtTime(L.global, t, 0.6)
  g.radio.gain.setTargetAtTime(active.def.radio ? L.radio : 0, t, 0.6)
  g.crackle.gain.setTargetAtTime(L.crackle * 0.6, t, 0.4)
  g.drums.gain.setTargetAtTime(L.drums, t, 0.3)
  if (m === 'off') {
    if (timer) clearInterval(timer)
    timer = null
    return
  }
  if (was === 'off' || !timer) {
    step = 0
    next = c.currentTime + 0.1
    timer = setInterval(tick, 25)
  }
}

export const radioEmitter = () => (built ? g.radioEm : null)

/** Travel: the radio moves to the new district's café (or goes quiet if it has none). */
export function syncRadio() {
  const c = audioCtx()
  if (!c || !built) return
  const r = active.def.radio
  if (r) moveEmitter(g.radioEm, r[0], r[1], r[2])
  g.radio.gain.setTargetAtTime(r ? LEVELS[mode].radio : 0, c.currentTime, 0.6)
}
