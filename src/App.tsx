import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Login from './pages/Login'
import Home from './pages/Home'
import Module from './pages/Module'
import Questionnaire from './pages/Questionnaire'
import More from './pages/More'
import Account from './pages/Account'
import Layout from './components/Layout'

function Private({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <p className="center">Cargando...</p>
  if (!session) return <Navigate to="/" replace />
  if (profile && !profile.onboarding_completed) return <Navigate to="/registro" replace />
  return <>{children}</>
}

function Public({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <p className="center">Cargando...</p>
  if (session && profile?.onboarding_completed) return <Navigate to="/app" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Public><Landing /></Public>} />
          <Route path="/login" element={<Public><Login /></Public>} />
          <Route path="/registro" element={<Onboarding />} />

          <Route path="/app" element={<Private><Layout /></Private>}>
            <Route index element={<Home />} />
            <Route path="mas" element={<More />} />
            <Route path="mas/cuenta" element={<Account />} />
            <Route path=":module" element={<Module />} />
            <Route path=":module/perfil" element={<Questionnaire />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}