import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Only these two are sent to the browser. The publishable key is safe to ship (row-level
  // security guards the data). SUPABASE_SECRET_KEY is deliberately NOT listed — it must
  // never reach client code.
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  },
}

export default nextConfig
