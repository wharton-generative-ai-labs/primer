import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { env } from '@/config/env'
import { getCSPHeaders, isDevelopmentMode, getProductionUrl } from '@/lib/csp'

/**
 * Middleware for authentication and security headers
 * 
 * This middleware handles:
 * 1. Authentication (redirects to sign-in if not authenticated)
 * 2. Content Security Policy (CSP) headers
 * 
 * Authorization (permission checks) is handled by individual pages and API routes
 * using the usePermissions hook or hasPermission function.
 * 
 * This design allows for:
 * 1. File-based users (managed through admin UI) to access the system
 * 2. Class members to access experiences they're enrolled in
 * 3. Flexible permission checking at the page/API level
 * 
 * Note: Middleware runs in Edge Runtime, so we can't use Node.js APIs like fs.
 * Audit logging is skipped in middleware (handled in API routes instead).
 */

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const devAuthBypassEnabled =
    env.NODE_ENV !== 'production' && env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';

  // Store the current URL to redirect back after auth
  const currentUrl = request.nextUrl.pathname + request.nextUrl.search

  // Allow these paths without any auth
  const publicPaths = [
    '/auth/signin',
    '/auth/test',
    '/auth/unauthorized',
    '/api/auth',
    '/api/diagnostic', // Diagnostic endpoints for troubleshooting
    '/images',
    '/_next',
    '/favicon.ico'
  ]

  const isPublicPath = publicPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isPublicPath) {
    return NextResponse.next()
  }

  // Redirect to sign-in if not authenticated
  if (!token && !devAuthBypassEnabled) {
    // Note: Audit logging is skipped in middleware (Edge Runtime limitation)
    // Authentication failures are logged in the auth API route instead
    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('returnUrl', encodeURIComponent(currentUrl))
    return NextResponse.redirect(signInUrl)
  }

  // All authenticated users can proceed
  // Individual pages and APIs check permissions using:
  // - usePermissions hook (client-side)
  // - hasPermission/hasMergedPermission functions (server-side)
  
  // Add CSP headers to the response
  const response = NextResponse.next()
  const cspHeaders = getCSPHeaders({ 
    isDevelopment: isDevelopmentMode(),
    productionUrl: getProductionUrl()
  })
  
  Object.entries(cspHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api/auth (auth endpoints)
     * - _next (Next.js internals)
     * - static files (images, favicon, etc)
     */
    '/((?!api/auth|_next|static|images|favicon.ico).*)',
    '/api/:path*', // Include API routes (except auth) for protection
  ]
}
