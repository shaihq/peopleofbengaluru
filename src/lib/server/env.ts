import 'server-only'

/**
 * True only on the Vercel production deployment. Vercel sets VERCEL_ENV itself
 * (production | preview | development); locally it's unset, so local and preview are never production.
 */
export function isProduction() {
  return process.env.VERCEL_ENV === 'production'
}
