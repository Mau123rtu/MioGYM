import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { calcAge, calcBMI } from '../lib/utils'
import Reminders from '../components/Reminders'
import Icon from '../components/Icons'

const GOAL: Record<string, string> = {
  masa: 'Ganar masa muscular', grasa: 'Perder grasa', fuerza: 'Ganar fuerza',
  condicion: 'Mejorar condición física', saludable: 'Mantenerme saludable',
}
const LEVEL: Record<string, string> = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' }
const PLACE: Record<string, string> = {
  gimnasio: 'Gimnasio', casa: 'En casa', casa_basico: 'Casa con equipo básico', aire_libre: 'Al aire libre', indeciso: 'Sin decidir',
}
const MIN_DAYS: Record<string, number> = { '1-2': 1, '3-4': 3, '5-6': 5, '7': 7 }

const MODS = [
  { slug: 'ejercicios', db: 'rutinas', icon: 'dumbbell', title: 'Rutinas', text: 'Ejercicios, series, repeticiones y progresión' },
  { slug: 'nutricion', db: 'nutricion', icon: 'food', title: 'Nutrición', text: 'Comidas, recetas y estimaciones nutricionales' },
  { slug: 'lesiones', db: 'lesiones', icon: 'shield', title: 'Prevención', text: 'Restricciones, técnica y precauciones' },
  { slug: 'suplementos', db: 'suplementos', icon: 'pill', title: 'Suplementos', text: 'Información, calidad y seguridad' },
]

interface WeightLog { id: number; weight_kg: number; logged_at: string }
interface WorkoutLog { exercise: string; weight_kg: number; logged_at: string }

export default function Account() {
  const { profile, session, refreshProfile } = useAuth()
  const [weight, setWeight] = useState(String(profile?.weight_kg ?? ''))
  const [height, setHeight] = useState(String(profile?.height_cm ?? ''))
  const [wlogs, setWlogs] = useState<WeightLog[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [done, setDone] = useState<string[]>([])
  const [msg, setMsg] = useState('')

  const load = async () => {
    const w = await supabase.from('weight_logs').select('*').order('logged_at', { ascending: true })
    setWlogs((w.data as WeightLog[]) ?? [])
    const l = await supabase.from('workout_logs').select('exercise,weight_kg,logged_at').order('logged_at', { ascending: true }).limit(1000)
    setLogs((l.data as WorkoutLog[]) ?? [])
    const m = await supabase.from('module_profiles').select('module')
    setDone((m.data ?? []).map(d => d.module))
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    const w = Number(weight), h = Number(height)
    if (!w || !h) return
    const uid = session!.user.id
    const { error } = await supabase.from('profiles').update({ weight_kg: w, height_cm: h }).eq('id', uid)
    if (error) { setMsg(error.message); return }
    if (w !== profile?.weight_kg) await supabase.from('weight_logs').insert({ user_id: uid, weight_kg: w })
    await refreshProfile(); await load()
    setMsg('Datos actualizados')
  }

  const name = profile?.full_name ?? profile?.username ?? ''
  const age = calcAge(profile?.birth_date ?? null)
  const bmi = calcBMI(Number(weight), Number(height))

  // Seguimiento
  const weights = wlogs.map(w => Number(w.weight_kg))
  const diff = weights.length > 1 ? Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10 : 0
  const dayKey = (iso: string) => new Date(iso).toDateString()
  const allDays = new Set(logs.map(l => dayKey(l.logged_at)))
  const weekAgo = Date.now() - 7 * 86400000
  const weekDays = new Set(logs.filter(l => new Date(l.logged_at).getTime() >= weekAgo).map(l => dayKey(l.logged_at)))
  const target = MIN_DAYS[profile?.days_per_week ?? '3-4'] ?? 3
  const adherence = Math.min(100, Math.round((weekDays.size / target) * 100))
  const first: Record<string, number> = {}, latest: Record<string, number> = {}
  logs.forEach(l => { if (!(l.exercise in first)) first[l.exercise] = l.weight_kg; latest[l.exercise] = l.weight_kg })
  const progressed = Object.keys(latest).filter(e => latest[e] > first[e]).length

  return (
    <>
      <Link to="/app/mas" className="back">← Volver</Link>
      <h1>Mi cuenta</h1>

      {/* 1. Perfil general */}
      <div className="flow-card">
        <div className="flow-icon"><Icon name="user" size={26} /></div>
        <h3>Perfil general del usuario</h3>
        <p className="hint">Edad, medidas, objetivo, experiencia y disponibilidad</p>
        <p style={{ margin: '.8rem 0 0' }}><b>{name}</b> (@{profile?.username})</p>
        <p className="hint" style={{ margin: 0 }}>{session?.user.email}</p>
        <div className="chips">
          {age !== null && <span className="tag">{age} años</span>}
          <span className="tag">{GOAL[profile?.goal ?? ''] ?? '-'}</span>
          <span className="tag">{LEVEL[profile?.experience ?? ''] ?? '-'}</span>
          <span className="tag">{profile?.days_per_week} días/sem</span>
          <span className="tag">{PLACE[profile?.training_place ?? ''] ?? '-'}</span>
        </div>
      </div>

      <div className="card">
        <h3>Peso y altura</h3>
        <label>Peso (kg)<input type="number" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} /></label>
        <label>Altura (cm)<input type="number" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} /></label>
        {bmi && <p>IMC: <b>{bmi.value}</b> ({bmi.label})</p>}
        <button className="btn primary" onClick={save}>Guardar</button>
        {msg && <p className="hint">{msg}</p>}
      </div>

      <div className="arrow">↓</div>

      {/* 2. Los 4 módulos */}
      <div className="mods">
        {MODS.map(m => {
          const ok = done.includes(m.db)
          return (
            <Link key={m.slug} to={ok ? `/app/${m.slug}` : `/app/${m.slug}/perfil`} className="mod">
              <div className="mod-icon"><Icon name={m.icon} size={26} /></div>
              <b>{m.title}</b>
              <small>{m.text}</small>
              <span className={ok ? 'status ok' : 'status'}>{ok ? 'Personalizado' : 'Completar perfil'}</span>
            </Link>
          )
        })}
      </div>

      <div className="arrow">↓</div>

      {/* 3. Seguimiento del progreso */}
      <div className="flow-card">
        <div className="flow-icon"><Icon name="chart" size={26} /></div>
        <h3>Seguimiento del progreso</h3>
        <p className="hint">Mediciones, entrenamientos realizados, adherencia y ajustes progresivos</p>
        <div className="stats">
          <div className="stat"><b>{diff > 0 ? '+' : ''}{diff} kg</b><small>Cambio de peso</small></div>
          <div className="stat"><b>{allDays.size}</b><small>Entrenos registrados</small></div>
          <div className="stat"><b>{adherence}%</b><small>Adherencia semanal</small></div>
        </div>
        <p className="hint" style={{ marginTop: '.8rem' }}>
          Esta semana: {weekDays.size} de {target} días. {progressed > 0
            ? `Has subido la carga en ${progressed} ejercicio(s): sigue progresando de forma gradual.`
            : 'Registra tus cargas en Rutinas para ver tus ajustes progresivos.'}
        </p>
      </div>

      <div className="card">
        <h3>Historial de peso</h3>
        {wlogs.length === 0 && <p className="hint">Sin registros todavía.</p>}
        {[...wlogs].reverse().slice(0, 10).map(l => (
          <p key={l.id} className="logrow"><span>{new Date(l.logged_at).toLocaleDateString()}</span><b>{l.weight_kg} kg</b></p>
        ))}
      </div>

      <Reminders />

      <button className="btn" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </>
  )
}