import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message, links: [], hosts: [] }, { status })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  const [kind, id, season, episode] = path

  if (!['movie', 'series'].includes(kind) || !/^\d+$/.test(id ?? '')) {
    return jsonError('Use /liens/movie/:tmdbId or /liens/series/:tmdbId', 400)
  }

  if (kind === 'movie' && (season || episode)) {
    return jsonError('A movie does not accept season or episode parameters', 400)
  }

  if (kind === 'series' && episode && !season) {
    return jsonError('An episode requires a season', 400)
  }

  const relayOrigin = (
    process.env.RELAY_ORIGIN ||
    process.env.BACKEND_URL ||
    process.env.V0_RUNTIME_URL ||
    'https://deploy-project-preview.v0.build'
  ).replace(/\/$/, '')
  if (!relayOrigin) {
    return jsonError(
      'Relay unavailable: configure RELAY_ORIGIN or BACKEND_URL on the deployed project',
      503,
    )
  }

  // The relay exposes the existing backend routes as /api/liens/film/:id
  // and /api/liens/serie/:id (not /api/links).
  const relayPath = kind === 'movie' ? `api/liens/film/${id}` : `api/liens/serie/${id}`
  const query = new URLSearchParams()
  if (season) query.set('season', season)
  if (episode) query.set('episode', episode)

  // Pass the title resolved by TMDB when available. This keeps the public
  // Vercel endpoint working even when the relay has no TMDB variable.
  const configuredTmdbKey = process.env.TMDB_API_KEY_2
  const tmdbKey =
    configuredTmdbKey && !configuredTmdbKey.startsWith('process.env.')
      ? configuredTmdbKey
      : process.env.TMDB_API_KEY
  if (tmdbKey) {
    try {
      const tmdbType = kind === 'movie' ? 'movie' : 'tv'
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${encodeURIComponent(tmdbKey)}&language=fr-FR`,
        { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
      )
      if (tmdbResponse.ok) {
        const tmdb = await tmdbResponse.json()
        const title = tmdb.title || tmdb.name || tmdb.original_title || tmdb.original_name
        if (title) query.set('title', title)
      }
    } catch {
      // The relay can still resolve the title with its own configuration.
    }
  }

  try {
    const response = await fetch(`${relayOrigin}/${relayPath}?${query.toString()}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })

    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return jsonError('Relay could not be reached', 502)
  }
}

export const POST = GET
export const OPTIONS = () => new NextResponse(null, { status: 204 })
