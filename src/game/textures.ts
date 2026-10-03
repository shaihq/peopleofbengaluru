import * as THREE from 'three'
import { C } from '@/lib/palette'

// Painted canvas textures. Flat color fields with soft, hand-made variation —
// never photo textures (design.md §5).

export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function toTex(c: HTMLCanvasElement, repeat = true) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

const base = new Map<string, THREE.CanvasTexture>()
function once(key: string, make: () => THREE.CanvasTexture) {
  let t = base.get(key)
  if (!t) {
    t = make()
    base.set(key, t)
  }
  return t
}

/** Clone a shared base texture with its own repeat. */
export function repeated(t: THREE.Texture, rx: number, ry: number) {
  const c = t.clone()
  c.repeat.set(rx, ry)
  c.needsUpdate = true
  return c
}

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex)
  c.offsetHSL(0, 0, amt)
  return `#${c.getHexString()}`
}

function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, n: number, alpha: number, size: number) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const x = r() * w
    const y = r() * h
    const rad = size * (0.4 + r())
    const light = r() > 0.5
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    const col = light ? '255,250,235' : '20,18,30'
    g.addColorStop(0, `rgba(${col},${alpha})`)
    g.addColorStop(1, `rgba(${col},0)`)
    ctx.fillStyle = g
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      ctx.save()
      ctx.translate(ox, oy)
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
      ctx.restore()
    }
  }
}

/** Asphalt — one tile covers 10m. */
export function asphaltTex() {
  return once('asphalt', () => {
    const [c, ctx] = canvas(512, 512)
    ctx.fillStyle = C.ASPHALT
    ctx.fillRect(0, 0, 512, 512)
    blotches(ctx, 512, 512, 3, 220, 0.06, 60)
    // tar seams
    const r = rng(9)
    ctx.strokeStyle = 'rgba(25,24,30,0.22)'
    ctx.lineCap = 'round'
    for (let i = 0; i < 6; i++) {
      ctx.lineWidth = 2 + r() * 2
      ctx.beginPath()
      let x = r() * 512
      let y = r() * 512
      ctx.moveTo(x, y)
      for (let j = 0; j < 5; j++) {
        x += (r() - 0.5) * 90
        y += (r() - 0.5) * 90
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    return toTex(c)
  })
}

/** Sidewalk pavers — one tile covers 1m (2 rows, running bond). */
export function paverTex() {
  return once('paver', () => {
    const S = 256
    const [c, ctx] = canvas(S, S)
    const r = rng(21)
    ctx.fillStyle = shade(C.PAVER, -0.08)
    ctx.fillRect(0, 0, S, S)
    const rows = 2
    const cols = 2
    const rh = S / rows
    const cw = S / cols
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? cw / 2 : 0
      for (let x = -1; x < cols + 1; x++) {
        ctx.fillStyle = shade(C.PAVER, (r() - 0.5) * 0.05)
        ctx.fillRect(x * cw + off + 3, y * rh + 3, cw - 6, rh - 6)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(x * cw + off + 3, y * rh + 3, cw - 6, 4)
      }
    }
    blotches(ctx, S, S, 22, 30, 0.05, 50)
    return toTex(c)
  })
}

/** Park lawn — one tile covers 4m. */
export function grassTex() {
  return once('grass', () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = C.GRASS
    ctx.fillRect(0, 0, 256, 256)
    blotches(ctx, 256, 256, 31, 90, 0.09, 40)
    return toTex(c)
  })
}

/** Mangalore clay tiles — one tile covers 2m. */
export function roofTileTex() {
  return once('roof', () => {
    const S = 256
    const [c, ctx] = canvas(S, S)
    const r = rng(41)
    const rows = 8
    const rh = S / rows
    const tw = S / 6
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? tw / 2 : 0
      for (let x = -1; x < 7; x++) {
        ctx.fillStyle = shade(C.ROOF_TILE, (r() - 0.5) * 0.07)
        ctx.fillRect(x * tw + off, y * rh, tw - 2, rh)
        ctx.fillStyle = 'rgba(255,230,200,0.12)'
        ctx.fillRect(x * tw + off, y * rh, tw - 2, 4)
      }
      ctx.fillStyle = 'rgba(60,20,10,0.35)'
      ctx.fillRect(0, y * rh + rh - 6, S, 6)
    }
    return toTex(c)
  })
}

/** Two-color canvas awning stripes — one tile covers 1m. */
export function stripeTex(a: string, b: string) {
  return once(`stripe|${a}|${b}`, () => {
    const [c, ctx] = canvas(256, 64)
    ctx.fillStyle = a
    ctx.fillRect(0, 0, 128, 64)
    ctx.fillStyle = b
    ctx.fillRect(128, 0, 128, 64)
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, 'rgba(255,255,255,0.06)')
    g.addColorStop(1, 'rgba(0,0,0,0.1)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 64)
    return toTex(c)
  })
}

/** Rolling shop shutter — horizontal corrugation. */
export function shutterTex() {
  return once('shutter', () => {
    const [c, ctx] = canvas(64, 64)
    for (let i = 0; i < 8; i++) {
      const g = ctx.createLinearGradient(0, i * 8, 0, i * 8 + 8)
      g.addColorStop(0, '#B4BCC4')
      g.addColorStop(0.5, '#98A2AC')
      g.addColorStop(1, '#7D8791')
      ctx.fillStyle = g
      ctx.fillRect(0, i * 8, 64, 8)
    }
    return toTex(c)
  })
}

/** Simplified window grid for distant blocks — one tile is 2 bays x 2 floors. */
export function farFacadeTex(wall: string) {
  return once(`far|${wall}`, () => {
    const [c, ctx] = canvas(128, 128)
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const px = x * 64 + 18
        const py = y * 64 + 16
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(px - 4, py - 4, 36, 40)
        ctx.fillStyle = shade(C.GLASS, 0.05)
        ctx.fillRect(px, py, 28, 32)
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.fillRect(px - 8, py - 10, 44, 5)
      }
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(0, 60, 128, 4)
    ctx.fillRect(0, 124, 128, 4)
    return toTex(c)
  })
}

// ---------------------------------------------------------------------------
// Signboards (Kannada + English, hand-painted)
// ---------------------------------------------------------------------------

export type SignSpec = { title: string; kn?: string; sub?: string; bg: string; fg: string }

export function fontVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'sans-serif'
}

let fontPromise: Promise<void> | null = null
let fontsReady = false

/** Suspends until the sign fonts are loaded, so canvas text never falls back. */
export function useFontsReady() {
  if (fontsReady) return
  fontPromise ??= Promise.all([
    document.fonts.load(`italic 800 64px ${fontVar('--font-display')}`, 'ABC'),
    document.fonts.load(`600 64px ${fontVar('--font-body')}`, 'ABC'),
    document.fonts.load(`700 64px ${fontVar('--font-kannada')}`, 'ನಮ್ಮ'),
  ]).then(
    () => {
      fontsReady = true
    },
    () => {
      fontsReady = true
    },
  )
  throw fontPromise
}

export function signTexture(spec: SignSpec, w: number, h: number) {
  let H = 320
  let W = Math.round((H * w) / h)
  if (W > 2048) {
    W = 2048
    H = Math.round((2048 * h) / w)
  }
  const [c, ctx] = canvas(W, H)
  const display = fontVar('--font-display')
  const body = fontVar('--font-body')
  const kn = fontVar('--font-kannada')

  ctx.fillStyle = spec.bg
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(255,255,255,0.10)')
  g.addColorStop(1, 'rgba(0,0,0,0.14)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const bw = Math.round(H * 0.04)
  ctx.strokeStyle = spec.fg
  ctx.globalAlpha = 0.85
  ctx.lineWidth = bw * 0.6
  ctx.strokeRect(bw * 1.3, bw * 1.3, W - bw * 2.6, H - bw * 2.6)
  ctx.globalAlpha = 1

  type Line = { text: string; font: (s: number) => string; size: number }
  const lines: Line[] = []
  if (spec.kn) lines.push({ text: spec.kn, font: (s) => `700 ${s}px ${kn}`, size: 0.25 })
  lines.push({ text: spec.title, font: (s) => `italic 800 ${s}px ${display}`, size: spec.kn || spec.sub ? 0.36 : 0.56 })
  if (spec.sub) lines.push({ text: spec.sub, font: (s) => `600 ${s}px ${body}`, size: 0.13 })
  const gap = 0.05
  const total = lines.reduce((a, l) => a + l.size, 0) + gap * (lines.length - 1)
  let y = ((1 - total) / 2) * H

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxW = W * 0.86
  for (const l of lines) {
    let size = l.size * H
    ctx.font = l.font(size)
    const m = ctx.measureText(l.text).width
    if (m > maxW) {
      size *= maxW / m
      ctx.font = l.font(size)
    }
    const cy = y + (l.size * H) / 2
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillText(l.text, W / 2 + size * 0.03, cy + size * 0.05)
    ctx.fillStyle = spec.fg
    ctx.fillText(l.text, W / 2, cy)
    y += (l.size + gap) * H
  }

  // painted speckle
  const r = rng(spec.title.length * 131 + W)
  for (let i = 0; i < (W * H) / 900; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(r() * W, r() * H, 2 + r() * 3, 2 + r() * 3)
  }
  return toTex(c, false)
}

// ---------------------------------------------------------------------------
// Ground decals (alpha-tested)
// ---------------------------------------------------------------------------

function decalTex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Chalk kolam drawn at a doorstep each morning — dots, petals and loops. */
export function rangoliTex(seed: number) {
  return once(`rangoli|${seed}`, () => {
    const S = 512
    const [c, ctx] = canvas(S, S)
    const r = rng(seed)
    const cx = S / 2
    const accent = [C.FLAME, C.KERB_YELLOW, C.WALL_PINK, C.AUTO_GREEN][Math.floor(r() * 4)]
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // coloured fill petals
    const petals = 8
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2
      ctx.save()
      ctx.translate(cx, cx)
      ctx.rotate(a)
      ctx.fillStyle = i % 2 ? accent : C.KERB_YELLOW
      ctx.beginPath()
      ctx.ellipse(0, -120, 34, 70, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(cx, cx, 60, 0, Math.PI * 2)
    ctx.fill()
    // white chalk outlines
    ctx.strokeStyle = '#F7F1E4'
    ctx.lineWidth = 9
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2
      ctx.save()
      ctx.translate(cx, cx)
      ctx.rotate(a)
      ctx.beginPath()
      ctx.ellipse(0, -120, 34, 70, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    for (const rad of [60, 200, 232]) {
      ctx.beginPath()
      ctx.arc(cx, cx, rad, 0, Math.PI * 2)
      ctx.stroke()
    }
    // dot ring
    ctx.fillStyle = '#F7F1E4'
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * 216, cx + Math.sin(a) * 216, 7, 0, Math.PI * 2)
      ctx.fill()
    }
    // chalky breakup
    ctx.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.5})`
      ctx.fillRect(r() * S, r() * S, 2 + r() * 4, 2 + r() * 4)
    }
    return decalTex(c)
  })
}

/** Fallen gulmohar petals under the tree. */
export function petalsTex() {
  return once('petals', () => {
    const S = 512
    const [c, ctx] = canvas(S, S)
    const r = rng(404)
    for (let i = 0; i < 520; i++) {
      const a = r() * Math.PI * 2
      const d = Math.pow(r(), 0.7) * S * 0.47
      const x = S / 2 + Math.cos(a) * d
      const y = S / 2 + Math.sin(a) * d
      ctx.fillStyle = r() > 0.25 ? C.FLAME : C.KERB_YELLOW
      ctx.beginPath()
      ctx.ellipse(x, y, 4 + r() * 4, 2.5 + r() * 2, r() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    return decalTex(c)
  })
}

/** Dust and tyre grime collecting along the kerb. */
export function grimeTex() {
  return once('grime', () => {
    const [c, ctx] = canvas(256, 64)
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, 'rgba(120,104,82,0.55)')
    g.addColorStop(0.35, 'rgba(110,96,78,0.28)')
    g.addColorStop(1, 'rgba(110,96,78,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 64)
    const r = rng(17)
    ctx.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(0,0,0,${r() * 0.5})`
      ctx.beginPath()
      ctx.arc(r() * 256, r() * 64, 2 + r() * 10, 0, Math.PI * 2)
      ctx.fill()
    }
    const t = decalTex(c)
    t.wrapS = THREE.RepeatWrapping
    return t
  })
}
