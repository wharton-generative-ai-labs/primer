import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateUrl } from '@/app/lib/security/url-validation'
import { rateLimit, getClientIdentifier, rateLimitConfigs } from '@/app/lib/rate-limit'

// Schema for proxy request query parameters
const ProxyQuerySchema = z.object({
    url: z.string().url('URL parameter must be a valid URL').min(1, 'URL parameter is required')
})

export async function GET(request: Request) {
    // Apply rate limiting for proxy requests
    const identifier = getClientIdentifier(request);
    const limitResult = rateLimit(identifier, rateLimitConfigs.api);
    
    if (!limitResult.allowed) {
      return NextResponse.json(
        { error: limitResult.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limitResult.max.toString(),
            'X-RateLimit-Remaining': limitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(limitResult.resetTime).toISOString(),
            'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }

    const { searchParams } = new URL(request.url)
    const urlParam = searchParams.get('url')

    // Validate query parameters with Zod
    const validationResult = ProxyQuerySchema.safeParse({ url: urlParam })
    
    if (!validationResult.success) {
        return NextResponse.json(
            { 
                error: 'Validation failed',
                details: validationResult.error.issues.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message
                }))
            },
            { status: 400 }
        )
    }

    const url = validationResult.data.url

    // Validate URL to prevent SSRF attacks
    try {
        validateUrl(url)
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Invalid URL' },
            { status: 403 }
        )
    }

    try {
        const response = await fetch(url)
        const data = await response.text()
        return new NextResponse(data, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/json'
            }
        })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 500 })
    }
}