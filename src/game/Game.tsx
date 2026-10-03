'use client'

import * as THREE from 'three'
import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { C } from '@/lib/palette'
import { Lighting } from './scene/Lighting'
import { Clouds, SkyDome } from './scene/Sky'
import { Effects } from './scene/Effects'
import { World } from './world/World'
import { Player } from './player/Player'
import { People } from './people/People'
import { requestLook } from './player/input'
import { HUD } from './hud/HUD'
import { Intro } from './hud/Intro'
import { SelectScreen } from './hud/SelectScreen'
import { Interaction } from './hud/Interaction'
import { Search } from './hud/Search'
import { Tracker } from './hud/Tracker'
import { Trail } from './world/Trail'
import { useGame } from './store'

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
        if (e.target instanceof HTMLCanvasElement && useGame.getState().phase === 'play') requestLook(true)
      }}
    >
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        flat
        dpr={[1, 1.75]}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: 56, near: 0.2, far: 1200, position: [40, 16, 30] }}
      >
        <color attach="background" args={[C.SKY_HORIZON]} />
        <fog attach="fog" args={[C.SKY_HORIZON, 85, 430]} />
        <Suspense fallback={null}>
          <SkyDome />
          <Clouds />
          <Lighting />
          <World />
          <Player />
          <People />
          <Trail />
          <Effects />
          <Ready />
        </Suspense>
      </Canvas>
      <HUD />
      <Interaction />
      <Tracker />
      <Search />
      <SelectScreen />
      <Intro />
    </div>
  )
}
