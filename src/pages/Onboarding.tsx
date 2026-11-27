import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { lbToKg, ftInToCm } from '../lib/utils'
import { Link } from 'react-router-dom'
import PasswordField from '../components/PasswordField'
import { checkPassword } from '../lib/password'
import { TERMS_VERSION } from './../lib/terms'
import RulerPicker from '../components/RulerPicker'

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
  const [terms, setTerms] = useState(false)
  const [wTouched, setWTouched] = useState(false)
  const [hTouched, setHTouched] = useState(false)

  const [f, setF] = useState({
    email: '', username: '', password: '',
    name: '', birth: '', goal: '',
    weight: '', weightUnit: 'kg',
    heightUnit: 'cm', height: '', feet: '', inches: '',
    level: '', days: '', place: '',
  })
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
    
  // Validación de peso y altura (solo si el usuario ha interactuado con los campos)
  const KG_LB = 2.20462
  const clampN = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

  // Peso
  const wKg = f.weightUnit === 'kg'
  const wVal = Number(f.weight) || (wKg ? 70 : 154)
  const setWeight = (v: number) => { set('weight', v.toFixed(1)); setWTouched(true) }
  const switchWeight = (u: 'kg' | 'lb') => {
    if (u === f.weightUnit) return
    const nv = u === 'lb'
      ? clampN(Math.round((wVal * KG_LB - 67) / 0.2) * 0.2 + 67, 67, 551)
      : clampN(Math.round((wVal / KG_LB) * 10) / 10, 30, 250)
    setF(p => ({ ...p, weightUnit: u, weight: nv.toFixed(1) }))
  }

  // Altura
  const hCm = f.heightUnit === 'cm'
  const hVal = hCm ? (Number(f.height) || 170) : (Number(f.feet) > 0 ? Number(f.feet) * 12 + (Number(f.inches) || 0) : 67)
  const setHeightCm = (v: number) => { set('height', String(v)); setHTouched(true) }
  const setHeightIn = (v: number) => { setF(p => ({ ...p, feet: String(Math.floor(v / 12)), inches: String(v % 12) })); setHTouched(true) }
  const switchHeight = (u: 'cm' | 'ft') => {
    if (u === f.heightUnit) return
    if (u === 'ft') {
      const inch = clampN(Math.round(hVal / 2.54), 36, 98)
      setF(p => ({ ...p, heightUnit: 'ft', feet: String(Math.floor(inch / 12)), inches: String(inch % 12) }))
    } else {
      setF(p => ({ ...p, heightUnit: 'cm', height: String(clampN(Math.round(hVal * 2.54), 90, 250)) }))
    }
  }
  const ftIn = (inch: number) => `${Math.floor(inch / 12)}′ ${inch % 12}″`
  const cmToIn = (cm: number) => Math.round(cm / 2.54)


  const TOTAL = 9 // paso 0 + 8 preguntas

  const canNext = (): boolean => {
    switch (step) {
            case 0: return /\S+@\S+\.\S+/.test(f.email) && f.username.trim().length >= 3 && terms
        && checkPassword(f.password, { username: f.username, email: f.email }).valid
      case 1: return f.name.trim().length > 0
      case 2: return !!f.birth && new Date(f.birth) < new Date()
      case 3: return !!f.goal
      case 4: return wTouched && Number(f.weight) > 0
      case 5: return hTouched && (f.heightUnit === 'cm' ? Number(f.height) > 0 : Number(f.feet) > 0)
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
      options: { data: { username: f.username.trim() } },
    })
    if (error) throw error
    if (!data.session) throw new Error('Desactiva "Confirm email" en Supabase (Authentication → Providers → Email) para continuar.')
    await supabase.from('profiles')
      .update({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }).eq('id', data.user!.id)
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
            
                      <label className="chkline">
            <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>He leído y acepto los <Link to="/terminos" target="_blank" rel="noreferrer">Términos y condiciones</Link> y la política de privacidad.</span>
          </label>
        </>
      )}

      {step === 1 && (<>
        <h2>¿Cómo te llamas?</h2>
        <input placeholder="Tu nombre completo" value={f.name} onChange={e => set('name', e.target.value)} autoFocus />
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
        <p className="hint">Desliza la regla hasta tu peso.</p>
        <div className="rp-row">
          <div className="rp-val">
            <div className="seg">
              <button type="button" className={wKg ? 'on' : ''} onClick={() => switchWeight('kg')}>kg</button>
              <button type="button" className={!wKg ? 'on' : ''} onClick={() => switchWeight('lb')}>lb</button>
            </div>
            <div className="rp-num">{wVal.toFixed(1)}<small>{f.weightUnit}</small></div>
            <p className="hint" style={{ margin: 0 }}>
              ≈ {wKg ? `${(wVal * KG_LB).toFixed(1)} lb` : `${(wVal / KG_LB).toFixed(1)} kg`}
            </p>
            {!wTouched && <p className="hint">Mueve la regla para continuar.</p>}
          </div>
          {wKg
            ? <RulerPicker key="kg" value={wVal} min={30} max={250} step={0.1} tick={10} major={10} mid={5}
                label={v => String(Math.round(v))} onChange={setWeight} ariaLabel="Peso en kilogramos" />
            : <RulerPicker key="lb" value={wVal} min={67} max={551} step={0.2} tick={8} major={5} mid={25}
                label={v => String(Math.round(v))} onChange={setWeight} ariaLabel="Peso en libras" />}
        </div>
      </>)}

      {step === 5 && (<>
        <h2>¿Cuánto mides?</h2>
        <p className="hint">Desliza la regla hasta tu estatura.</p>
        <div className="rp-row">
          <div className="rp-val">
            <div className="seg">
              <button type="button" className={hCm ? 'on' : ''} onClick={() => switchHeight('cm')}>cm</button>
              <button type="button" className={!hCm ? 'on' : ''} onClick={() => switchHeight('ft')}>ft</button>
            </div>
            <div className="rp-num">
              {hCm ? hVal : ftIn(hVal)}{hCm && <small>cm</small>}
            </div>
            <p className="hint" style={{ margin: 0 }}>
              ≈ {hCm ? ftIn(cmToIn(hVal)) : `${Math.round(hVal * 2.54)} cm`}
            </p>
            {!hTouched && <p className="hint">Mueve la regla para continuar.</p>}
          </div>
          {hCm
            ? <RulerPicker key="cm" value={hVal} min={90} max={250} step={1} tick={12} major={10} mid={5}
                label={v => String(v)} onChange={setHeightCm} ariaLabel="Estatura en centímetros" />
            : <RulerPicker key="ft" value={hVal} min={36} max={98} step={1} tick={14} major={12} mid={6}
                label={v => `${v / 12}′`} onChange={setHeightIn} ariaLabel="Estatura en pies y pulgadas" />}
        </div>
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