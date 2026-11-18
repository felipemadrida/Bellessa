import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, setToken } from './api'
import { configureMoney } from './format'
import type { Business, Staff } from './types'

interface AuthValue {
  user: Staff | null
  business: Business | null
  ready: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (payload: {
    business_name: string
    owner_name: string
    email: string
    password: string
    phone?: string
    city?: string
  }) => Promise<void>
  signOut: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Staff | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [ready, setReady] = useState(false)

  const clear = useCallback(() => {
    setToken(null)
    setUser(null)
    setBusiness(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setReady(true)
      return
    }
    try {
      const data = await api.auth.me()
      setUser(data.user)
      setBusiness(data.business)
    } catch {
      clear()
    } finally {
      setReady(true)
    }
  }, [clear])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onUnauthorized = () => {
      clear()
      setReady(true)
    }
    window.addEventListener('bellessa:unauthorized', onUnauthorized)
    return () => window.removeEventListener('bellessa:unauthorized', onUnauthorized)
  }, [clear])

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api.auth.login(email, password)
    setToken(data.access_token)
    setUser(data.user)
    setBusiness(data.business)
    setReady(true)
  }, [])

  const signUp = useCallback<AuthValue['signUp']>(async (payload) => {
    const data = await api.auth.register(payload)
    setToken(data.access_token)
    setUser(data.user)
    setBusiness(data.business)
    setReady(true)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ user, business, ready, signIn, signUp, signOut: clear, refresh }),
    [user, business, ready, signIn, signUp, clear, refresh],
  )

  // La moneda del salón se aplica antes de renderizar a sus hijas, de modo que
  // cada `money()` de la app respeta la divisa base al instante.
  configureMoney({ currency: business?.currency, locale: business?.locale })

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
