import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_HOSTS, PUBLIC_HOSTS } from '@/lib/site'

// The review queue at admin.peopleofbengaluru.com, and dev.admin.peopleofbengaluru.com for staging
// (CLAUDE.md "SEO + ANALYTICS" / 5E-B):
// - on an admin host, / is the admin page and the API works as usual; everything else goes to /.
// - on the public sites (production and dev), /admin doesn't exist (404).
// - previews and local keep /admin (they have no admin subdomain).
// The admin page's data is guarded in the database (is_admin()), not here: this only decides addresses.

const noindex = (res: NextResponse) => {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export function proxy(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase().split(':')[0]
  const { pathname } = req.nextUrl

  if (ADMIN_HOSTS.includes(host)) {
    if (pathname === '/') return noindex(NextResponse.rewrite(new URL('/admin', req.url)))
    if (pathname.startsWith('/api/')) return noindex(NextResponse.next())
    return noindex(NextResponse.redirect(new URL('/', req.url)))
  }

  if (PUBLIC_HOSTS.includes(host) && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    return noindex(new NextResponse('Not found', { status: 404 }))
  }

  return NextResponse.next()
}

export const config = {
  // pages and the API; not the build's files or the game's assets
  matcher: ['/((?!_next/static|_next/image|models/|audio/|.*\\.(?:svg|png|jpg|jpeg|webp|glb|gltf|woff2?|mp3|ogg)$).*)'],
}
