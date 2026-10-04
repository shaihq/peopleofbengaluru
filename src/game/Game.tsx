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
import { Session } from './Session'
import { Interaction } from './hud/Interaction'
import { Search } from './hud/Search'
import { Tracker } from './hud/Tracker'
import { Trail } from './world/Trail'
import { AudioDirector } from './audio/AudioDirector'
import { useGame } from './store'
import { isTouch, quality } from './device'
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
        dpr={quality.dpr}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 56, near: 0.2, far: 1200, position: [40, 16, 30] }}
      >
        <color attach="background" args={[C.SKY_HORIZON]} />
        <fog attach="fog" args={[C.SKY_HORIZON, 85, 430]} />
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
      <TouchControls />
      <Interaction />
      <Tracker />
      <Search />
      <PortalPicker />
      <Travel />
      <YouCard />
      <Create />
      <Pause />
      <Toast />
      <Session />
      <Intro />
    </div>
  )
}
