'use client'

import './districts' // registers every built district (must load first)
import * as THREE from 'three'
import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { C } from '@/lib/palette'
import { Lighting } from './scene/Lighting'
import { Clouds, SkyDome } from './scene/Sky'
import { Effects } from './scene/Effects'
import { DistrictWorld } from './world/DistrictWorld'
import { PortalController } from './world/PortalController'
import { PortalPicker } from './hud/PortalPicker'
import { Travel } from './hud/Travel'
import { Player } from './player/Player'
import { People } from './people/People'
import { requestLook } from './player/input'
import { HUD } from './hud/HUD'
import { Intro } from './hud/Intro'
import { Create } from './hud/Create'
import { Pause } from './hud/Pause'
import { YouCard, Toast } from './hud/YouCard'
import { StatusEditor } from './hud/StatusEditor'
import { Connections } from './hud/Connections'
import { Invites } from './hud/Invites'
import { Session } from './Session'
import { Interaction } from './hud/Interaction'
import { Search } from './hud/Search'
import { Tracker } from './hud/Tracker'
import { Trail } from './world/Trail'
import { AudioDirector } from './audio/AudioDirector'
import { useGame } from './store'
import { isTablet, isTouch, profile, showQualityDebug, useDebugToggles, useQuality, type DebugToggles } from './device'
import { FrameGraph, RenderStats } from './hud/FrameGraph'
import { PerformanceMonitor } from '@react-three/drei'
import { TouchControls } from './hud/TouchControls'

function Ready() {
  const setReady = useGame((s) => s.setReady)
  useEffect(() => {
    // give the merged city a frame to upload before revealing the CTA
    const id = requestAnimationFrame(() => setReady())
    return () => cancelAnimationFrame(id)
  }, [setReady])
  return null
}

export default function Game() {
  const level = useQuality((s) => s.level)
  const step = useQuality((s) => s.step)
  return (
    <div
      className="game-root"
      onMouseDown={(e) => {
        // only the canvas grabs the mouse — HUD buttons must stay clickable
        if (!isTouch && e.target instanceof HTMLCanvasElement && useGame.getState().phase === 'play') requestLook(true)
      }}
    >
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        flat
        dpr={profile(level).dpr}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 56, near: 0.2, far: 1200, position: [40, 16, 30] }}
      >
        <color attach="background" args={[C.SKY_HORIZON]} />
        <fog attach="fog" args={[C.SKY_HORIZON, 85, 430]} />
        {/* adaptive quality: step down if this device can't hold ~45fps, back up when it can */}
        {showQualityDebug && <RenderStats />}
        <PerformanceMonitor
          bounds={() => [32, 55]}
          flipflops={2}
          onDecline={() => step(-1)}
          onIncline={() => step(1)}
          onFallback={() => useQuality.getState().lock()}
          onChange={({ fps }) => useQuality.getState().setFps(Math.round(fps))}
        />
        <Suspense fallback={null}>
          <SkyDome />
          <Clouds />
          <Lighting />
          <DistrictWorld />
          <PortalController />
          <Player />
          <People />
          <Trail />
          <AudioDirector />
          <Effects />
          <Ready />
        </Suspense>
      </Canvas>
      <HUD />
      {showQualityDebug && <QualityDebug />}
      <TouchControls />
      <Interaction />
      <Tracker />
      <Search />
      <PortalPicker />
      <Travel />
      <YouCard />
      <StatusEditor />
      <Connections />
      <Invites />
      <Create />
      <Pause />
      <Toast />
      <Session />
      <Intro />
    </div>
  )
}

function QualityDebug() {
  const level = useQuality((s) => s.level)
  const locked = useQuality((s) => s.locked)
  const p = profile(level)
  const t = useDebugToggles()
  const keys: [keyof DebugToggles, string][] = [
    ['shadows', 'SHADOWS'],
    ['bloom', 'BLOOM'],
  ]
  return (
    <div className="quality-debug">
      <div className="qd-toggles">
        {keys.map(([k, label]) => (
          <button key={k} className={t[k] ? 'on' : ''} onClick={() => t.toggle(k)} onTouchStart={(e) => e.stopPropagation()}>
            {label}
          </button>
        ))}
      </div>
      {isTablet ? 'TABLET' : isTouch ? 'PHONE' : 'DESKTOP'} · Q{level} · DPR {p.dpr.toFixed(2)}/{typeof window !== 'undefined' ? window.devicePixelRatio : 1} · {typeof window !== 'undefined' ? ((window.innerWidth * window.innerHeight * p.dpr * p.dpr) / 1e6).toFixed(1) : 0}MP · AO {p.ao ?? 'off'}{locked ? ' · LOCKED' : ''}
      <FrameGraph />
    </div>
  )
}
