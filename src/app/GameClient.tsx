'use client'

import dynamic from 'next/dynamic'

// WebGL world is client-only. Until it loads, the boot screen shows the intro's title in the same spot,
// so it reads as one screen; it's also the page's text for search engines (the game itself is a canvas).
const Game = dynamic(() => import('@/game/Game'), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <div className="intro-title">
        <div className="intro-kicker">PEOPLE OF</div>
        <h1>BENGALURU</h1>
        <p>Walk the city. Meet the people who design it.</p>
      </div>
    </div>
  ),
})

export default function GameClient() {
  return <Game />
}
