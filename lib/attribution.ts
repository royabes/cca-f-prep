/**
 * First-party attribution: two http-only cookies set by middleware on first visit, read back by
 * the API routes and attached to every LLM call as `ctx`. No personal data, no third parties.
 */
import type { NextRequest, NextResponse } from 'next/server'
import { CTX_KEYS, type UsageCtx } from './usage-shared'

export const VISITOR_COOKIE = 'rab_vid'
export const SOURCE_COOKIE = 'rab_src'
const ONE_YEAR = 60 * 60 * 24 * 365

/** Compact source record stored in the cookie: referrer host, landing path, utm, first seen. */
export interface SourceRecord {
  r?: string
  l?: string
  s?: string
  m?: string
  c?: string
  t?: string
}

const cap = (v: string | null | undefined, n = 200) => (v ? v.slice(0, n) : undefined)

export function hostOf(referer: string | null | undefined): string | undefined {
  if (!referer) return undefined
  try {
    return new URL(referer).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return undefined
  }
}

/** Builds the source record for a first visit. Internal referrers (this site) are not a source. */
export function buildSourceRecord(url: URL, referer: string | null | undefined, siteHost: string, now = new Date()): SourceRecord {
  const rec: SourceRecord = { l: cap(url.pathname, 200), t: now.toISOString().slice(0, 10) }
  const h = hostOf(referer)
  if (h && h !== siteHost.replace(/^www\./, '').toLowerCase()) rec.r = cap(h, 100)
  const utm = (k: string) => cap(url.searchParams.get(k), 100)
  if (utm('utm_source')) rec.s = utm('utm_source')
  if (utm('utm_medium')) rec.m = utm('utm_medium')
  if (utm('utm_campaign')) rec.c = utm('utm_campaign')
  return rec
}

export function parseSourceCookie(raw: string | undefined): SourceRecord {
  if (!raw) return {}
  try {
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? (o as SourceRecord) : {}
  } catch {
    return {}
  }
}

export function deviceFromUA(ua: string | null | undefined): 'desktop' | 'mobile' | 'bot' {
  const s = (ua || '').toLowerCase()
  if (!s) return 'desktop'
  if (/bot|crawl|spider|slurp|fetch|headless|python-requests|curl\//.test(s)) return 'bot'
  if (/mobi|android|iphone|ipad|tablet/.test(s)) return 'mobile'
  return 'desktop'
}

/** Sets the two attribution cookies on a response when the request lacks them. */
export function applyAttributionCookies(request: NextRequest, response: NextResponse, siteHost: string): void {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: ONE_YEAR }
  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), base)
  }
  if (!request.cookies.get(SOURCE_COOKIE)) {
    const rec = buildSourceRecord(request.nextUrl, request.headers.get('referer'), siteHost)
    response.cookies.set(SOURCE_COOKIE, JSON.stringify(rec), base)
  }
}

/** Attribution for one API call, read from cookies and headers only. */
export function readCtx(request: NextRequest): UsageCtx {
  const src = parseSourceCookie(request.cookies.get(SOURCE_COOKIE)?.value)
  let page: string | undefined
  try {
    const ref = request.headers.get('referer')
    if (ref) page = cap(new URL(ref).pathname, 200)
  } catch {
    /* no page */
  }
  const ctx: UsageCtx = {
    visitor_id: cap(request.cookies.get(VISITOR_COOKIE)?.value, 64) ?? null,
    page: page ?? null,
    landing_path: src.l ?? null,
    referrer_host: src.r ?? null,
    utm_source: src.s ?? null,
    utm_medium: src.m ?? null,
    utm_campaign: src.c ?? null,
    country: cap(request.headers.get('x-vercel-ip-country'), 8) ?? null,
    device: deviceFromUA(request.headers.get('user-agent')),
  }
  for (const k of CTX_KEYS) if (ctx[k] == null) delete ctx[k]
  return ctx
}

export function withAttribution<T extends object>(request: NextRequest, body: T): T & { ctx: UsageCtx } {
  return { ...body, ctx: readCtx(request) }
}
