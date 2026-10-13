import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// The share card (Open Graph + X): the game's title card, design.md §10 — ink, saffron, Barlow Condensed
// 800 italic caps. Built once at build time. A real in-game screenshot can replace it later:
// drop an opengraph-image.png here and delete this file.

export const alt = 'People of Bengaluru: walk the city, meet its designers and builders'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const font = (file: string) => readFile(join(process.cwd(), 'node_modules/@fontsource/barlow-condensed/files', file))

export default async function Image() {
  const [bold, semi] = await Promise.all([font('barlow-condensed-latin-800-italic.woff'), font('barlow-condensed-latin-600-normal.woff')])
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '0 80px 84px',
          background: '#1C1F2B',
          borderTop: '14px solid #FFB020',
          color: '#FFF6E5',
          fontFamily: 'Barlow Condensed',
        }}
      >
        <div style={{ display: 'flex' }}>
          <div
            style={{
              display: 'flex',
              padding: '6px 22px',
              background: '#FFB020',
              color: '#1C1F2B',
              fontSize: 40,
              fontWeight: 800,
              fontStyle: 'italic',
              letterSpacing: 3,
              transform: 'skewX(-8deg)',
            }}
          >
            PEOPLE OF
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 8, fontSize: 210, fontWeight: 800, fontStyle: 'italic', lineHeight: 0.9, textShadow: '0 10px 0 #0C0E16' }}>
          BENGALURU
        </div>
        <div style={{ display: 'flex', marginTop: 26, fontSize: 44, fontWeight: 600, color: 'rgba(255, 246, 229, 0.82)' }}>
          Walk the city. Meet the designers and builders who live in it.
        </div>
        <div style={{ display: 'flex', marginTop: 34, fontSize: 30, fontWeight: 600, letterSpacing: 4, color: '#3DDC84' }}>
          PEOPLEOFBENGALURU.COM
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Barlow Condensed', data: bold, weight: 800, style: 'italic' },
        { name: 'Barlow Condensed', data: semi, weight: 600, style: 'normal' },
      ],
    },
  )
}
