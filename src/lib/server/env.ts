import 'server-only'

/**
 * True only on the Vercel production deployment. Vercel sets VERCEL_ENV itself
 * (production | preview | development); locally it's unset, so local and preview are never production.
 */
export function isProduction() {
  return process.env.VERCEL_ENV === 'production'
}

/** Our own site addresses. Not secrets — Vercel sets the VERCEL_* ones itself. */
const PRODUCTION_URL = 'https://peopleofbengaluru.vercel.app'
const KNOWN = [
  PRODUCTION_URL,
  'https://peopleofbengaluru-dev.vercel.app',
  'http://localhost:3000',
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
].filter(Boolean) as string[]

/**
 * Where links in emails point. The request's Origin header is only used when it's one of
 * ours — otherwise anyone could make our emails link to their own site.
 */
export function siteOrigin(req: Request) {
  const o = req.headers.get('origin')
  if (o && KNOWN.includes(o)) return o
  if (process.env.VERCEL_BRANCH_URL && !isProduction()) return `https://${process.env.VERCEL_BRANCH_URL}`
  return PRODUCTION_URL
}
