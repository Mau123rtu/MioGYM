import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { lbToKg, ftInToCm } from '../lib/utils'
import { Link } from 'react-router-dom'
import PasswordField from '../components/PasswordField'
import { checkPassword } from '../lib/password'

const GOALS = [
  ['masa', 'Ganar masa muscular'], ['grasa', 'Perder grasa corporal'], ['fuerza', 'Ganar fuerza'],
  ['condicion', 'Mejorar mi condición física'], ['saludable', 'Mantenerme saludable'],
]
const LEVELS = [['principiante', 'Principiante'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado']]
const DAYS = [['1-2', '1–2 días'], ['3-4', '3–4 días'], ['5-6', '5–6 días'], ['7', '7 días']]
const PLACES = [
  ['gimnasio', 'Gimnasio'], ['casa', 'En casa'], ['casa_basico', 'En casa con equipo básico'],
  ['aire_libre', 'Al aire libre'], ['indeciso', 'Todavía no lo he decidido'],
]

function Options({ items, value, onChange }: { items: string[][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="options">
      {items.map(([v, label]) => (
        <button key={v} type="button" className={value === v ? 'option selected' : 'option'} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function Onboarding() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()

  // Si ya hay sesión (cuenta creada), empezamos en las preguntas (paso 1)
  const [step, setStep] = useState(session ? 1 : 0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [f, setF] = useState({
    email: '', username: '', password: '',
    name: '', birth: '', goal: '',
    weight: '', weightUnit: 'kg',
    heightUnit: 'cm', height: '', feet: '', inches: '',
    level: '', days: '', place: '',
  })
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const TOTAL = 9 // paso 0 + 8 preguntas

  const canNext = (): boolean => {
    switch (step) {
      case 0: return /\S+@\S+\.\S+/.test(f.email) && f.username.trim().length >= 3
        && checkPassword(f.password, { username: f.username, email: f.email }).valid
      case 1: return f.name.trim().length > 0
      case 2: return !!f.birth && new Date(f.birth) < new Date()
      case 3: return !!f.goal
      case 4: return Number(f.weight) > 0
      case 5: return f.heightUnit === 'cm' ? Number(f.height) > 0 : Number(f.feet) > 0
      case 6: return !!f.level
      case 7: return !!f.days
      case 8: return !!f.place
      default: return false
    }
  }

  const createAccount = async () => {
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { data: { username: f.username.trim() } }, // el trigger lo guarda en profiles
    })
    if (error) throw error
    if (!data.session) throw new Error('Desactiva "Confirm email" en Supabase (Authentication → Providers → Email) para continuar.')
  }

  const finish = async () => {
    const { data: u } = await supabase.auth.getUser()
    const userId = u.user!.id
    const weightKg = f.weightUnit === 'kg' ? Number(f.weight) : lbToKg(Number(f.weight))
    const heightCm = f.heightUnit === 'cm' ? Number(f.height) : ftInToCm(Number(f.feet), Number(f.inches || 0))

    const { error } = await supabase.from('profiles').update({
      full_name: f.name.trim(),
      birth_date: f.birth,
      goal: f.goal,
      weight_kg: Math.round(weightKg * 100) / 100,
      height_cm: Math.round(heightCm * 100) / 100,
      experience: f.level,
      days_per_week: f.days,
      training_place: f.place,
      onboarding_completed: true,
    }).eq('id', userId)
    if (error) throw error

    await supabase.from('weight_logs').insert({ user_id: userId, weight_kg: weightKg })
    await refreshProfile()
    navigate('/app', { replace: true })
  }

  const next = async () => {
    setError('')
    setBusy(true)
    try {
      if (step === 0) await createAccount()
      if (step === 8) { await finish(); return }
      setStep(s => s + 1)
    } catch (e: any) {
      setError(e.message ?? 'Ocurrió un error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wizard">
      <div className="progress"><div style={{ width: `${((step + 1) / TOTAL) * 100}%` }} /></div>

            {step === 0 && (
        <>
          <Link to="/" className="back">← Volver al inicio</Link>
          <h2>Crea tu cuenta</h2>
          <input type="email" placeholder="Correo" value={f.email} onChange={e => set('email', e.target.value)} autoComplete="email" />
          <input placeholder="Usuario (mín. 3 caracteres)" value={f.username} onChange={e => set('username', e.target.value)} autoComplete="username" />
          <PasswordField value={f.password} onChange={v => set('password', v)} showRules
            ctx={{ username: f.username, email: f.email }} autoComplete="new-password" />
        </>
      )}

      {step === 1 && (<>
        <h2>¿Cómo te llamas?</h2>
        <input placeholder="Tu nombre" value={f.name} onChange={e => set('name', e.target.value)} autoFocus />
      </>)}

      {step === 2 && (<>
        <h2>¿Qué edad tienes?</h2>
        <p className="hint">Indica tu fecha de nacimiento</p>
        <input type="date" value={f.birth} onChange={e => set('birth', e.target.value)} />
      </>)}

      {step === 3 && (<>
        <h2>¿Cuál es tu principal objetivo físico?</h2>
        <Options items={GOALS} value={f.goal} onChange={v => set('goal', v)} />
      </>)}

      {step === 4 && (<>
        <h2>¿Cuál es tu peso actual?</h2>
        <div className="row">
          <input type="number" inputMode="decimal" placeholder="Peso" value={f.weight} onChange={e => set('weight', e.target.value)} />
          <select value={f.weightUnit} onChange={e => set('weightUnit', e.target.value)}>
            <option value="kg">kg</option><option value="lb">lb</option>
          </select>
        </div>
      </>)}

      {step === 5 && (<>
        <h2>¿Cuánto mides?</h2>
        <select value={f.heightUnit} onChange={e => set('heightUnit', e.target.value)}>
          <option value="cm">Centímetros</option><option value="ft">Pies y pulgadas</option>
        </select>
        {f.heightUnit === 'cm' ? (
          <input type="number" inputMode="decimal" placeholder="Altura en cm" value={f.height} onChange={e => set('height', e.target.value)} />
        ) : (
          <div className="row">
            <input type="number" placeholder="Pies" value={f.feet} onChange={e => set('feet', e.target.value)} />
            <input type="number" placeholder="Pulgadas" value={f.inches} onChange={e => set('inches', e.target.value)} />
          </div>
        )}
      </>)}

      {step === 6 && (<>
        <h2>¿Cuál es tu nivel de experiencia entrenando?</h2>
        <Options items={LEVELS} value={f.level} onChange={v => set('level', v)} />
      </>)}

      {step === 7 && (<>
        <h2>¿Cuántos días a la semana puedes dedicar al ejercicio?</h2>
        <Options items={DAYS} value={f.days} onChange={v => set('days', v)} />
      </>)}

      {step === 8 && (<>
        <h2>¿Dónde realizas o realizarás tu entrenamiento?</h2>
        <Options items={PLACES} value={f.place} onChange={v => set('place', v)} />
      </>)}

      {error && <p className="error">{error}</p>}

      <button className="btn primary" disabled={!canNext() || busy} onClick={next}>
        {busy ? 'Guardando...' : step === 8 ? 'Finalizar' : 'Siguiente'}
      </button>
      {step > 1 && <button className="link" onClick={() => setStep(s => s - 1)}>Atrás</button>}
    </div>
  )
}