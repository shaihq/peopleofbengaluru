'use client'

import dynamic from 'next/dynamic'

// WebGL world is client-only.
const Game = dynamic(() => import('@/game/Game'), {
  ssr: false,
  loading: () => <div className="boot" />,
})

export default function GameClient() {
  return <Game />
}
