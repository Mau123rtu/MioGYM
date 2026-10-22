import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { calcBMI } from '../lib/utils'
import { groupOf, planProgress, type Plan, type PlanDay } from '../lib/routine'
import Icon from '../components/Icons'
import { CalendarModal, useTrainingData } from '../components/Streak'


const MUSCLE: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros',
  brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}

const topMuscles = (d: PlanDay) => {
  const sets: Record<string, number> = {}
  d.exercises.forEach(e => { const g = groupOf(e.name); if (g) sets[g] = (sets[g] ?? 0) + e.sets })
  return Object.entries(sets).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => MUSCLE[g])
}

export default function Home() {
  const { profile } = useAuth()
  const bmi = calcBMI(profile?.weight_kg, profile?.height_cm)
  const [plan, setPlan] = useState<Plan | null>(null)
  const name = profile?.full_name ?? profile?.username ?? ''
  const training = useTrainingData()
  const [showCal, setShowCal] = useState(false)

  useEffect(() => {
    supabase.from('routines').select('plan').maybeSingle().then(({ data }) => setPlan(data?.plan ?? null))
  }, [])

  const pr = plan && plan.days.length > 0 ? planProgress(plan) : null
  const order: number[] = []
  if (pr) {
    for (let k = 0; k < 7; k++) {
      const i = (pr.todayIdx + k) % 7
      if (!pr.days[i].rest) order.push(i)
    }
  }

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

      <div className="streak-row">
        <div className="streak-mini">
          <span className="big">{training.st.cur}</span>
          <div>
            <b>{training.st.cur === 1 ? 'día de racha' : 'días de racha'}</b>
            <small>Mejor: {training.st.best}</small>
          </div>
        </div>

        <button className="cal-btn" onClick={() => setShowCal(true)}>
          <Icon name="calendar" size={22} />
          <span>Calendario</span>
        </button>
      </div>
      
      {showCal && <CalendarModal data={training} onClose={() => setShowCal(false)} />}
      <h2 className="section">Tu rutina</h2>
      {plan && plan.warnings.length > 0 && plan.days.length === 0 && <div className="urgent">{plan.warnings[0]}</div>}

      {pr ? (
        <>
          {pr.days[pr.todayIdx].rest && <p className="hint">Hoy es día de descanso. Tu próximo entrenamiento va primero.</p>}
          <div className="hscroll">
            {order.map((i, k) => {
              const d = pr.days[i]
              return (
                <div className={`rcard${k === 0 ? ' first' : ''}`} key={d.weekday}>
                  <small className="wk">{d.weekday}{i === pr.todayIdx && <span className="badge">Hoy</span>}</small>
                  <h3>{d.name.split(' · ')[1] ?? d.name}</h3>
                  <p className="hint">{d.exercises.length} ejercicios</p>
                  <div className="rtags">{topMuscles(d).map(m => <span className="tag" key={m}>{m}</span>)}</div>
                  <Link to="/app/ejercicios" state={{ day: i }} className="btn-ver">Ver</Link>
                </div>
              )
            })}
          </div>
          <Link to="/app/ejercicios" className="btn primary">Ir a mis rutinas</Link>
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