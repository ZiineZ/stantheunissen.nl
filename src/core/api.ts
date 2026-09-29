/* Thin client for the site's own API (server/index.mjs). Every call degrades
   quietly: the site must work as a static page when the API is down. */

export interface Entry {
  name: string
  bits: string
  at?: string
}

async function call<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
    if (!r.ok) {
      const body = await r.json().catch(() => null)
      return body && typeof body === 'object' ? ({ ...body, ok: false } as T) : null
    }
    return (await r.json()) as T
  } catch {
    return null
  }
}

export async function visit(): Promise<number | null> {
  let fresh = true
  try {
    fresh = !localStorage.getItem('visited')
  } catch {
    /* ignore */
  }
  const res = await call<{ count: number }>('/api/visit', { method: fresh ? 'POST' : 'GET' })
  if (res && typeof res.count === 'number') {
    try {
      localStorage.setItem('visited', '1')
    } catch {
      /* ignore */
    }
    return res.count
  }
  return null
}

export async function marks(): Promise<Entry[]> {
  const res = await call<{ entries: Entry[] }>('/api/guestbook')
  return res?.entries ?? []
}

export async function sign(name: string, bits: string, website: string): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('/api/guestbook', { method: 'POST', body: JSON.stringify({ name, bits, website }) })
  return res ?? { ok: false, error: 'offline' }
}

export async function contact(data: { name: string; email: string; message: string; website: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await call<{ ok: boolean; error?: string }>('/api/contact', { method: 'POST', body: JSON.stringify(data) })
  return res ?? { ok: false, error: 'offline' }
}
