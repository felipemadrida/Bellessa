import type {
  PlatformAdmin,
  PlatformLoginResponse,
  PlatformOverview,
  PlatformTenant,
  PlatformTenantUpdate,
} from './types'

const BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'bellessa_platform_token'

export class PlatformApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'PlatformApiError'
    this.status = status
  }
}

export function getPlatformToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setPlatformToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
}

async function platformRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' })
  const token = getPlatformToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let body: BodyInit | undefined
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    })
  } catch {
    throw new PlatformApiError(0, 'No pudimos conectar con la API de plataforma.')
  }
  if (!response.ok) {
    let message = 'No pudimos completar la operación.'
    try {
      const data = await response.json()
      if (typeof data?.detail === 'string') message = data.detail
    } catch {
      // La API no devolvió JSON.
    }
    if (response.status === 401) setPlatformToken(null)
    throw new PlatformApiError(response.status, message)
  }
  return (await response.json()) as T
}

export const platformApi = {
  login: (email: string, password: string) =>
    platformRequest<PlatformLoginResponse>('/platform/login', {
      method: 'POST',
      body: { email, password },
    }),
  me: () => platformRequest<PlatformAdmin>('/platform/me'),
  overview: () => platformRequest<PlatformOverview>('/platform/overview'),
  tenants: () => platformRequest<PlatformTenant[]>('/platform/tenants'),
  updateTenant: (businessId: number, payload: PlatformTenantUpdate) =>
    platformRequest<PlatformTenant>(`/platform/tenants/${businessId}`, {
      method: 'PATCH',
      body: payload,
    }),
}
