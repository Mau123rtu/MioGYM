import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { calcBMI } from '../lib/utils'
import { planProgress, type Plan } from '../lib/routine'

export default function Home() {
  const { profile } = useAuth()
  const bmi = calcBMI(profile?.weight_kg, profile?.height_cm)
  const [plan, setPlan] = useState<Plan | null>(null)
  const name = profile?.full_name ?? profile?.username ?? ''

  useEffect(() => {
    supabase.from('routines').select('plan').maybeSingle().then(({ data }) => setPlan(data?.plan ?? null))
  }, [])

  return (
    <>
      <header className="hero">
        <div><small>Bienvenido</small><h1>Hola, {name}</h1></div>
        <div className="avatar">{name.charAt(0).toUpperCase()}</div>
      </header>

      <div className="stats">
        <div className="stat"><b>{bmi?.value ?? '–'}</b><small>IMC · {bmi?.label ?? ''}</small></div>
        <div className="stat"><b>{profile?.weight_kg ?? '–'}</b><small>Peso (kg)</small></div>
        <div className="stat"><b>{profile?.height_cm ?? '–'}</b><small>Altura (cm)</small></div>
      </div>

      <h2 className="section">Tu rutina</h2>
      {plan && plan.warnings.length > 0 && plan.days.length === 0 && <div className="urgent">{plan.warnings[0]}</div>}
      {plan && plan.days.length > 0 ? (
        <>
          {planProgress(plan).days.map(d => (
            <Link to="/app/ejercicios" key={d.weekday} className="day"
              style={{ display: 'block', textDecoration: 'none', opacity: d.rest ? 0.5 : 1 }}>
              <h3>{d.name}</h3>
              {!d.rest && <p className="hint">{d.exercises.slice(0, 4).map(e => e.name).join(' · ')}{d.exercises.length > 4 ? '…' : ''}</p>}
            </Link>
          ))}
          <Link to="/app/ejercicios" className="btn primary">Entrenar hoy</Link>
        </>
      ) : !plan && (
        <Link to="/app/ejercicios/perfil" className="cta">
          Completa tu perfil de rutinas para personalizar tus recomendaciones
          <small>Crearemos tu rutina semanal</small>
        </Link>
      )}
    </>
  )
}