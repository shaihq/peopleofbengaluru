import type { Metadata, Viewport } from 'next'
import { Barlow, Barlow_Condensed, Noto_Sans_Kannada } from 'next/font/google'
import './globals.css'

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})

const body = Barlow({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-body',
})

const kannada = Noto_Sans_Kannada({
  subsets: ['kannada'],
  weight: ['600', '700'],
  variable: '--font-kannada',
})

export const metadata: Metadata = {
  title: 'Designers of Bengaluru',
  description: 'Walk through Bengaluru and discover the people who design it.',
}

export const viewport: Viewport = {
  themeColor: '#1C1F2B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${kannada.variable}`}>
      <body>{children}</body>
    </html>
  )
}
