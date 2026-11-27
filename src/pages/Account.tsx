import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { calcAge, calcBMI } from '../lib/utils'
import Reminders from '../components/Reminders'
import Icon from '../components/Icons'
import AvatarEditor from '../components/AvatarEditor'
import ProgressPhotos from '../components/ProgressPhotos'
import Measurements from '../components/Measurements'
import PasswordField from '../components/PasswordField'
import { checkPassword } from '../lib/password'
import { safeInsert } from '../lib/offline'
import { blockInvalidKeys, LIMITS } from '../lib/limits'


const GOAL: Record<string, string> = {
  masa: 'Ganar masa muscular', grasa: 'Perder grasa', fuerza: 'Ganar fuerza',
  condicion: 'Mejorar condición física', saludable: 'Mantenerme saludable',
}
const LEVEL: Record<string, string> = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' }
const PLACE: Record<string, string> = {
  gimnasio: 'Gimnasio', casa: 'En casa', casa_basico: 'Casa con equipo básico', aire_libre: 'Al aire libre', indeciso: 'Sin decidir',
}
const MIN_DAYS: Record<string, number> = { '1-2': 1, '3-4': 3, '5-6': 5, '7': 7 }

interface WeightLog { id: number; weight_kg: number; logged_at: string }
interface WorkoutLog { exercise: string; weight_kg: number; logged_at: string }

/** Sección plegable con resumen */
function Section({ id, icon, title, summary, open, onToggle, children }: {
  id: string; icon: string; title: string; summary?: string
  open: boolean; onToggle: (id: string) => void; children: ReactNode
}) {
  return (
    <div className={`acc${open ? ' open' : ''}`}>
      <button className="acc-h" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="acc-ic"><Icon name={icon} size={20} /></span>
        <span className="acc-t"><b>{title}</b>{summary && <small>{summary}</small>}</span>
        <Icon name={open ? 'up' : 'down'} size={18} />
      </button>
      {open && <div className="acc-b">{children}</div>}
    </div>
  )
}

export default function Account() {
  const { profile, session, refreshProfile } = useAuth()
  const [openId, setOpenId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenId(o => (o === id ? null : id))

  const [weight, setWeight] = useState(String(profile?.weight_kg ?? ''))
  const [height, setHeight] = useState(String(profile?.height_cm ?? ''))
  const [wlogs, setWlogs] = useState<WeightLog[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [msg, setMsg] = useState('')

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busyPw, setBusyPw] = useState(false)

  const load = async () => {
    const w = await supabase.from('weight_logs').select('*').order('logged_at', { ascending: true })
    setWlogs((w.data as WeightLog[]) ?? [])
    const l = await supabase.from('workout_logs').select('exercise,weight_kg,logged_at').order('logged_at', { ascending: true }).limit(1000)
    setLogs((l.data as WorkoutLog[]) ?? [])
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    const w = Number(weight), h = Number(height)
    if (!weight || !height || Number.isNaN(w) || Number.isNaN(h)) {
      setMsg('Ingresa tu peso y tu altura.'); return
    }
    if (w < LIMITS.weight.min || w > LIMITS.weight.max) {
      setMsg(`El peso debe estar entre ${LIMITS.weight.min} y ${LIMITS.weight.max} kg.`); return
    }
    if (h < LIMITS.height.min || h > LIMITS.height.max) {
      setMsg(`La altura debe estar entre ${LIMITS.height.min} y ${LIMITS.height.max} cm.`); return
    }
    const uid = session!.user.id
    const { error } = await supabase.from('profiles').update({ weight_kg: w, height_cm: h }).eq('id', uid)
    if (error) { setMsg(error.message); return }
    if (w !== profile?.weight_kg) await safeInsert('weight_logs', { user_id: uid, weight_kg: w, logged_at: new Date().toISOString() })
    await refreshProfile(); await load()
    setMsg('Datos actualizados')
  }

  const setSex = async (s: 'hombre' | 'mujer') => {
    await supabase.from('profiles').update({ sex: s }).eq('id', session!.user.id)
    await refreshProfile()
  }

  const changePassword = async () => {
    setPwMsg(null)
    const email = session!.user.email!
    if (!checkPassword(newPw, { username: profile?.username ?? '', email }).valid) { setPwMsg({ ok: false, text: 'La nueva contraseña no cumple todos los requisitos.' }); return }
    if (newPw !== newPw2) { setPwMsg({ ok: false, text: 'Las contraseñas nuevas no coinciden.' }); return }
    if (newPw === curPw) { setPwMsg({ ok: false, text: 'La nueva contraseña debe ser distinta a la actual.' }); return }
    setBusyPw(true)
    const check = await supabase.auth.signInWithPassword({ email, password: curPw })
    if (check.error) { setBusyPw(false); setPwMsg({ ok: false, text: 'La contraseña actual es incorrecta.' }); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setBusyPw(false)
    if (error) { setPwMsg({ ok: false, text: error.message }); return }
    setCurPw(''); setNewPw(''); setNewPw2('')
    setPwMsg({ ok: true, text: 'Contraseña actualizada.' })
  }

  const name = profile?.full_name ?? profile?.username ?? ''
  const age = calcAge(profile?.birth_date ?? null)

  // IMC: solo usa los valores escritos si están dentro del rango permitido
  const wNum = Number(weight), hNum = Number(height)
  const wOk = wNum >= LIMITS.weight.min && wNum <= LIMITS.weight.max
  const hOk = hNum >= LIMITS.height.min && hNum <= LIMITS.height.max
  const bmi = calcBMI(wOk ? wNum : profile?.weight_kg, hOk ? hNum : profile?.height_cm)

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

      {/* Tarjeta principal: nombre y datos personales */}
      <div className="prof-hero">
        <AvatarEditor size={78} />
        <div className="ph-info">
          <h1>{name}</h1>
          <p>@{profile?.username}</p>
          <small>{session?.user.email}</small>
        </div>
      </div>
      <div className="prof-tags">
        {age !== null && <span className="tag">{age} años</span>}
        <span className="tag">{GOAL[profile?.goal ?? ''] ?? '-'}</span>
        <span className="tag">{LEVEL[profile?.experience ?? ''] ?? '-'}</span>
        <span className="tag">{profile?.days_per_week ?? '-'} días/sem</span>
        <span className="tag">{PLACE[profile?.training_place ?? ''] ?? '-'}</span>
      </div>

      {/* Datos principales en horizontal */}
      <div className="hscroll qstats">
        <div className="qs"><small>Peso</small><b>{profile?.weight_kg ?? '–'}</b><span>kg</span></div>
        <div className="qs hl"><small>IMC</small><b>{bmi?.value ?? '–'}</b><span>{bmi?.label ?? ''}</span></div>
        <div className="qs"><small>Adherencia</small><b>{adherence}%</b><span>esta semana</span></div>
        <div className="qs"><small>Entrenos</small><b>{allDays.size}</b><span>registrados</span></div>
      </div>

      <h3 className="sec-t">Mi cuenta</h3>

      <Section id="medidas" icon="weight" title="Peso y altura"
        summary={`${profile?.weight_kg ?? '–'} kg · ${profile?.height_cm ?? '–'} cm`}
        open={openId === 'medidas'} onToggle={toggle}>
        <div className="row">
          <label style={{ flex: 1 }}><span className="hint">Peso (kg)</span>
            <input type="number" inputMode="decimal" min={LIMITS.weight.min} max={LIMITS.weight.max} step="0.1"
              value={weight} onChange={e => setWeight(e.target.value)} onKeyDown={blockInvalidKeys} /></label>
          <label style={{ flex: 1 }}><span className="hint">Altura (cm)</span>
            <input type="number" inputMode="decimal" min={LIMITS.height.min} max={LIMITS.height.max} step="0.1"
              value={height} onChange={e => setHeight(e.target.value)} onKeyDown={blockInvalidKeys} /></label>
        </div>
        <p className="hint" style={{ margin: '.3rem 0 0' }}>
          Peso: {LIMITS.weight.min}–{LIMITS.weight.max} kg · Altura: {LIMITS.height.min}–{LIMITS.height.max} cm
        </p>
        {bmi && <p style={{ margin: '.4rem 0 0' }}>IMC: <b>{bmi.value}</b> ({bmi.label})</p>}
        <button className="btn primary" onClick={save}>Guardar</button>
        {msg && <p className="hint">{msg}</p>}
      </Section>

      <Section id="cuerpo" icon="tape" title="Medidas corporales" summary="Brazo, pierna, cintura, cadera y pecho"
        open={openId === 'cuerpo'} onToggle={toggle}>
        <Measurements />
      </Section>

      <Section id="foto" icon="camera" title="Foto y figura"
        summary={`Figura: ${profile?.sex === 'mujer' ? 'Mujer' : profile?.sex === 'hombre' ? 'Hombre' : 'sin elegir'} · fotos de progreso`}
        open={openId === 'foto'} onToggle={toggle}>
        <p className="hint" style={{ margin: '.4rem 0 .3rem' }}>Figura del muñeco (distribución muscular y rutinas)</p>
        <div className="tabs" style={{ marginBottom: '.6rem' }}>
          {(['hombre', 'mujer'] as const).map(s => (
            <button key={s} className={profile?.sex === s ? 'on' : ''} onClick={() => setSex(s)}>{s === 'hombre' ? 'Hombre' : 'Mujer'}</button>
          ))}
        </div>
        <h4 className="ph">Fotos de progreso</h4>
        <ProgressPhotos />
      </Section>

      <Section id="progreso" icon="chart" title="Seguimiento del progreso"
        summary={`${adherence}% adherencia semanal`}
        open={openId === 'progreso'} onToggle={toggle}>
        <div className="stats">
          <div className="stat"><b>{diff > 0 ? '+' : ''}{diff} kg</b><small>Cambio de peso</small></div>
          <div className="stat"><b>{allDays.size}</b><small>Entrenos</small></div>
          <div className="stat"><b>{adherence}%</b><small>Adherencia</small></div>
        </div>
        <p className="hint" style={{ marginTop: '.8rem' }}>
          Esta semana: {weekDays.size} de {target} días. {progressed > 0
            ? `Subiste la carga en ${progressed} ejercicio(s): sigue progresando de forma gradual.`
            : 'Registra tus cargas en Rutinas para ver tus ajustes progresivos.'}
        </p>
      </Section>

      <Section id="peso" icon="list" title="Historial de peso"
        summary={wlogs.length ? `${wlogs.length} registro${wlogs.length === 1 ? '' : 's'}` : 'Sin registros'}
        open={openId === 'peso'} onToggle={toggle}>
        {wlogs.length === 0 && <p className="hint" style={{ margin: 0 }}>Sin registros todavía.</p>}
        {[...wlogs].reverse().slice(0, 10).map(l => (
          <p key={l.id} className="logrow"><span>{new Date(l.logged_at).toLocaleDateString()}</span><b>{l.weight_kg} kg</b></p>
        ))}
      </Section>

      <Section id="recordatorios" icon="clock" title="Recordatorios" summary="Ejercicio y agua"
        open={openId === 'recordatorios'} onToggle={toggle}>
        <Reminders />
      </Section>

      <Section id="seguridad" icon="lock" title="Cambiar contraseña" summary="Seguridad de tu cuenta"
        open={openId === 'seguridad'} onToggle={toggle}>
        <PasswordField value={curPw} onChange={setCurPw} placeholder="Contraseña actual" autoComplete="current-password" />
        <PasswordField value={newPw} onChange={setNewPw} placeholder="Nueva contraseña" showRules
          ctx={{ username: profile?.username ?? '', email: session?.user.email ?? '' }} autoComplete="new-password" />
        <PasswordField value={newPw2} onChange={setNewPw2} placeholder="Repite la nueva contraseña" autoComplete="new-password" />
        {pwMsg && <p className={pwMsg.ok ? 'hint' : 'error'}>{pwMsg.text}</p>}
        <button className="btn primary" disabled={busyPw || !curPw || !newPw || !newPw2} onClick={changePassword}>
          {busyPw ? 'Guardando…' : 'Actualizar contraseña'}
        </button>
      </Section>

      <button className="btn dlg-out" style={{ marginTop: '1.4rem' }} onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </>
  )
}