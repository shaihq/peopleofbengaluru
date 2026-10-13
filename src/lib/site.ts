// The public face of the site: its address, name and what search engines may do with it.
// Server-side only where it matters (VERCEL_ENV isn't sent to the browser).

/** The one address search engines should know. Every other host (dev, previews, *.vercel.app) is noindex. */
export const SITE_URL = 'https://peopleofbengaluru.com'

/** The review queue lives on its own subdomain (src/proxy.ts): production, and dev (staging data). */
export const ADMIN_HOSTS = ['admin.peopleofbengaluru.com', 'dev.admin.peopleofbengaluru.com']

/** The game this page belongs to (browser only): admin.x → https://x, dev.admin.x → https://dev.x, else this origin. */
export function gameOrigin() {
  const h = window.location.hostname
  return ADMIN_HOSTS.includes(h) ? `https://${h.replace(/^(dev\.)?admin\./, '$1')}` : window.location.origin
}

/** The public sites' hosts, where /admin doesn't exist. */
export const PUBLIC_HOSTS = ['peopleofbengaluru.com', 'www.peopleofbengaluru.com', 'dev.peopleofbengaluru.com']

export const SITE_NAME = 'People of Bengaluru'

export const SITE_TITLE = 'People of Bengaluru — walk the city, meet its designers and builders'

export const SITE_DESCRIPTION =
  'A stylised 3D Bengaluru you can walk through. Every character is a real designer or builder: find them in Koramangala and HSR Layout, see what they’re building, and say hi.'

/** Google Analytics 4 measurement ID. Loads only on production (see ANALYTICS_ON). */
export const GA_ID = 'G-EEGWQWP5NM'

/**
 * True only on the Vercel production deployment (peopleofbengaluru.com). Dev, previews and local
 * are never indexed and never send analytics. Read at build time; Vercel sets VERCEL_ENV itself.
 */
export const IS_PRODUCTION = process.env.VERCEL_ENV === 'production'

export const ANALYTICS_ON = IS_PRODUCTION && !!GA_ID
