'use client'

import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/** Renderer counters from the last frame (?debug). Shadow passes included. */
export const renderStats = { calls: 0, tris: 0, geos: 0, progs: 0 }

/** Mount inside <Canvas>: copies gl.info into renderStats every frame. */
export function RenderStats() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.info.autoReset = false
  }, [gl])
  // runs before this frame renders, so it reads (then clears) the previous frame's totals
  useFrame(() => {
    const i = gl.info
    renderStats.calls = i.render.calls
    renderStats.tris = i.render.triangles
    renderStats.geos = i.memory.geometries
    renderStats.progs = i.programs?.length ?? 0
    i.reset()
  })
  return null
}

// ?debug only. Top: the last ~3 s of frames as bars (red = a hitch over 50 ms).
// Bottom: average fps in 4 s buckets over the last 2 minutes — a slow sag there is
// the phone heating up and throttling; isolated red bars are stalls (shader compiles,
// texture uploads).

const W = 240
const H_FRAMES = 44
const H_TREND = 28
const FRAMES = 180
const BUCKET_MS = 4000
const BUCKETS = 30
const HITCH_MS = 50

export function FrameGraph() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [stats, setStats] = useState({ avg: 0, worst: 0, hitches: 0, calls: 0, tris: 0, progs: 0 })

  useEffect(() => {
    const cv = ref.current!
    const dpr = window.devicePixelRatio || 1
    cv.width = W * dpr
    cv.height = (H_FRAMES + H_TREND + 4) * dpr
    const g = cv.getContext('2d')!
    g.scale(dpr, dpr)

    const frames = new Float32Array(FRAMES)
    let head = 0
    const trend: number[] = []
    let bucketStart = performance.now()
    let bucketFrames = 0
    const hitchTimes: number[] = []
    let last = performance.now()
    let raf = 0
    let lastStats = 0

    const tick = (now: number) => {
      const dt = now - last
      last = now
      frames[head] = dt
      head = (head + 1) % FRAMES
      bucketFrames++
      if (dt > HITCH_MS && dt < 1000 && document.visibilityState === 'visible') hitchTimes.push(now)
      if (now - bucketStart >= BUCKET_MS) {
        trend.push((bucketFrames * 1000) / (now - bucketStart))
        if (trend.length > BUCKETS) trend.shift()
        bucketStart = now
        bucketFrames = 0
      }

      g.clearRect(0, 0, W, H_FRAMES + H_TREND + 4)
      // frame bars: 16.7 ms = 1/3 height, 50 ms = full
      g.fillStyle = 'rgba(255,255,255,0.12)'
      g.fillRect(0, H_FRAMES - H_FRAMES / 3, W, 1)
      const bw = W / FRAMES
      for (let i = 0; i < FRAMES; i++) {
        const v = frames[(head + i) % FRAMES]
        const h = Math.min(H_FRAMES, (v / HITCH_MS) * H_FRAMES)
        g.fillStyle = v > HITCH_MS ? '#E5484D' : v > 20 ? '#FFB020' : '#5BD18B'
        g.fillRect(i * bw, H_FRAMES - h, Math.max(1, bw - 0.3), h)
      }
      // fps trend: 0..60 fps
      const ty = H_FRAMES + 4
      g.fillStyle = 'rgba(255,255,255,0.08)'
      g.fillRect(0, ty, W, H_TREND)
      g.strokeStyle = '#FFB020'
      g.lineWidth = 1.5
      g.beginPath()
      trend.forEach((f, i) => {
        const x = (i / (BUCKETS - 1)) * W
        const y = ty + H_TREND - (Math.min(f, 60) / 60) * H_TREND
        i ? g.lineTo(x, y) : g.moveTo(x, y)
      })
      g.stroke()

      if (now - lastStats > 500) {
        lastStats = now
        while (hitchTimes.length && now - hitchTimes[0] > 60000) hitchTimes.shift()
        let sum = 0
        let worst = 0
        for (const v of frames) if (v < 1000) worst = Math.max(worst, v)
        // ignore pauses over 1 s (screenshots, app switching) — they aren't render cost
        let n = 0
        sum = 0
        for (const v of frames) if (v > 0 && v < 1000) (sum += v), n++
        setStats({
          avg: Math.round((n * 1000) / Math.max(1, sum)),
          worst: Math.round(worst),
          hitches: hitchTimes.length,
          calls: renderStats.calls,
          tris: renderStats.tris,
          progs: renderStats.progs,
        })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="frame-graph">
      <canvas ref={ref} style={{ width: W, height: H_FRAMES + H_TREND + 4 }} />
      <div>
        {stats.avg} FPS · WORST {stats.worst} MS · {stats.hitches} HITCHES/MIN
      </div>
      <div>
        {stats.calls} DRAWS · {(stats.tris / 1e6).toFixed(2)}M TRIS · {stats.progs} SHADERS
      </div>
    </div>
  )
}
