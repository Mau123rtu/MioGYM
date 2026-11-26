import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  birth_date: string | null
  goal: string | null
  weight_kg: number | null
  height_cm: number | null
  experience: string | null
  days_per_week: string | null
  training_place: string | null
  onboarding_completed: boolean
  sex: string | null
  avatar_url: string | null
    terms_accepted_at: string | null
  terms_version: string | null
    assistant_consent_at: string | null
}

interface Ctx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<Ctx>({} as Ctx)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

    const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data as Profile)
      localStorage.setItem('miogym-profile', JSON.stringify(data))
      return
    }
    // sin internet: usa el último perfil guardado de esta misma cuenta
    try {
      const c = JSON.parse(localStorage.getItem('miogym-profile') ?? 'null')
      if (c?.id === userId) setProfile(c as Profile)
    } catch { /* nada */ }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      else {
        setProfile(null)
        localStorage.removeItem('miogym-profile')
        if ('caches' in window) caches.delete('supabase-api')   // no dejar datos de salud en el dispositivo
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const refreshProfile = async () => {
    if (session) await loadProfile(session.user.id)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}