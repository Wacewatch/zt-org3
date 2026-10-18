import { NextRequest, NextResponse } from 'next/server'

// The preview backend is the same relay used by the working preview.
// RELAY_ORIGIN/BACKEND_URL can override it in production when a dedicated
// backend is configured, but the deployed app remains functional by default.
const RELAY_ORIGIN = (
  process.env.RELAY_ORIGIN ||
  process.env.BACKEND_URL ||
  process.env.V0_RUNTIME_URL ||
  'https://deploy-project-preview.v0.build'
).replace(/\/$/, '')

async function relay(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const target = `${RELAY_ORIGIN}/api/${path.join('/')}${request.nextUrl.search}`
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    cache: 'no-store',
  })

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  })
}

export const GET = relay
export const POST = relay
export const PUT = relay
export const PATCH = relay
export const DELETE = relay
export const OPTIONS = relay
