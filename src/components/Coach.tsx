import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Icon from './Icons'
import { groupOf, planProgress, type Plan } from '../lib/routine'
import { streaks } from './Streak'
import { MIN_DAYS } from '../lib/progress'
import type { Summary } from '../lib/injury'

interface S { completed_at: string; day_name: string; duration_sec: number | null; ex_seconds: Record<string, number> | null }
interface L { exercise: string; weight_kg: number; logged_at: string }
interface W { weight_kg: number; logged_at: string }
interface Card { icon: string; title: string; text: string; kind: 'ok' | 'tip' | 'warn'; to?: string; state?: unknown; cta?: string; bar?: number }

const MUSCLE: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}
const TECH: Record<string, string[]> = {
  pecho: ['Junta y baja los omóplatos antes de empujar: cuidas el hombro y trabajas más el pecho.', 'Baja el peso en 2 o 3 segundos y sube sin rebotar.', 'Mantén los codos a unos 45° del cuerpo, no abiertos del todo.'],
  espalda: ['Piensa en llevar los codos hacia atrás, no en jalar con las manos.', 'Evita balancear el torso; si lo necesitas para mover el peso, es demasiado.', 'Junta los omóplatos al final del movimiento y suelta con control.'],
  hombros: ['No encojas los hombros hacia las orejas; sube solo hasta la altura del hombro.', 'En elevaciones, usa menos peso y más control: el hombro es una articulación delicada.', 'Evita arquear la espalda al empujar por encima de la cabeza.'],
  brazos: ['Mantén los codos quietos junto al cuerpo; si se mueven, el peso es muy alto.', 'Baja despacio: la fase de bajada también trabaja el músculo.', 'Estira por completo el brazo en cada repetición.'],
  piernas: ['Rodillas en la dirección de los pies y talones apoyados en el suelo.', 'Baja hasta donde puedas mantener la espalda neutra.', 'Empuja el suelo con todo el pie y sube sin bloquear las rodillas de golpe.'],
  abdomen: ['Exhala al contraer y evita jalar el cuello con las manos.', 'En la plancha mantén el cuerpo recto: ni cadera caída ni demasiado alta.', 'Calidad antes que cantidad: menos repeticiones, bien hechas.'],
}

const DAY = 86400000
const keyOf = (d: Date) => d.toLocaleDateString('en-CA')
const startOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const part = (n: string) => n.split(' · ').slice(1).join(' · ') || n
const dur = (s: number) => {
  const m = Math.round(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.max(1, m)} min`
}

export default function Coach({ plan, inj }: { plan: Plan | null; inj: Summary }) {
  const { profile } = useAuth()
  const [sess, setSess] = useState<S[] | null>(null)
  const [logs, setLogs] = useState<L[]>([])
  const [weights, setWeights] = useState<W[]>([])

  useEffect(() => {
    const since = new Date(Date.now() - 62 * DAY).toISOString()
    supabase.from('workout_sessions').select('completed_at,day_name,duration_sec,ex_seconds')
      .order('completed_at', { ascending: true }).limit(1000).then(({ data }) => setSess((data as S[]) ?? []))
    supabase.from('workout_logs').select('exercise,weight_kg,logged_at').gte('logged_at', since)
      .order('logged_at', { ascending: true }).limit(3000).then(({ data }) => setLogs((data as L[]) ?? []))
    supabase.from('weight_logs').select('weight_kg,logged_at').order('logged_at', { ascending: true })
      .then(({ data }) => setWeights((data as W[]) ?? []))
  }, [])

  const cards = useMemo<Card[]>(() => {
    if (!sess) return []
    const out: Card[] = []
    const now = new Date(), today0 = startOf(now), tk = keyOf(now)
    const target = MIN_DAYS[profile?.days_per_week ?? '3-4'] ?? 3
    const blocked = inj.mode === 'blocked'
    const pr = plan && plan.days.length > 0 ? planProgress(plan) : null
    const todayDay = pr?.days[pr.todayIdx]

    const dayKeys = new Set(sess.map(s => keyOf(new Date(s.completed_at))))
    const doneToday = sess.filter(s => keyOf(new Date(s.completed_at)) === tk)
    const last = sess[sess.length - 1]
    const since = last ? Math.floor((today0.getTime() - startOf(new Date(last.completed_at)).getTime()) / DAY) : null
    const mon = new Date(today0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
    const weekSess = sess.filter(s => new Date(s.completed_at) >= mon)
    const weekDays = new Set(weekSess.map(s => keyOf(new Date(s.completed_at)))).size
    const daysLeft = 6 - ((today0.getDay() + 6) % 7)

    const muscles = (list: S[]) => {
      const c: Record<string, number> = {}
      list.forEach(s => Object.entries(s.ex_seconds ?? {}).forEach(([n, v]) => { const g = groupOf(n); if (g) c[g] = (c[g] ?? 0) + v }))
      return Object.entries(c).sort((a, b) => b[1] - a[1]).map(x => x[0])
    }

    // 1. Hoy
    if (doneToday.length) {
      const gs = muscles(doneToday).map(g => MUSCLE[g]).slice(0, 3)
      const sec = doneToday.reduce((a, s) => a + (s.duration_sec ?? 0), 0)
      out.push({ icon: 'check', kind: 'ok', title: 'Hoy ya entrenaste',
        text: `${part(doneToday[0].day_name)}${sec ? ` · ${dur(sec)}` : ''}. ${gs.length ? `Deja descansar ${gs.join(', ').toLowerCase()} unas 48 horas antes de repetir. ` : ''}Come proteína y toma agua para recuperarte.` })
    } else if (blocked) {
      out.push({ icon: 'shield', kind: 'warn', title: 'Rutinas en pausa',
        text: 'Por tu molestia, tus rutinas están bloqueadas. Lo mejor ahora es descansar y seguir las indicaciones de Prevención.', to: '/app/lesiones', cta: 'Ver mi estado' })
    } else if (!pr) {
      out.push({ icon: 'dumbbell', kind: 'tip', title: 'Crea tu rutina', text: 'Completa tu perfil de rutinas y armamos tu semana de entrenamiento.', to: '/app/ejercicios/perfil', cta: 'Empezar' })
    } else if (todayDay && !todayDay.rest) {
      out.push({ icon: 'dumbbell', kind: 'tip', title: `Hoy toca: ${part(todayDay.name)}`,
        text: 'Calienta unos 5 minutos y anota tus cargas: es la única forma de ver tu progreso real.', to: '/app/ejercicios', state: { day: pr.todayIdx }, cta: 'Ver rutina' })
    } else {
      out.push({ icon: 'moon', kind: 'ok', title: 'Hoy es día de descanso',
        text: 'Descansar es parte del plan: es cuando el cuerpo se recupera. Camina un poco, estira, duerme de 7 a 9 horas y cuida tu alimentación.' })
    }

    // 2. Motivación si no entrenas
    if (!blocked && !doneToday.length) {
      const go = { to: '/app/ejercicios', cta: 'Ir a mis rutinas' }
      if (since === null) out.push({ icon: 'spark', kind: 'tip', title: 'Tu primer entreno', ...go,
        text: 'Aún no registras entrenamientos. No tiene que ser perfecto: empieza y marca todas las series para que la sesión cuente.' })
      else if (since >= 14) out.push({ icon: 'alert', kind: 'warn', title: `${since} días sin entrenar`, ...go,
        text: 'Retomar es lo que cuenta. Al volver, empieza con cargas 10 a 20% más bajas y sube en 1 o 2 semanas: tu cuerpo necesita readaptarse.' })
      else if (since >= 7) out.push({ icon: 'alert', kind: 'tip', title: 'Una semana sin entrenar', ...go,
        text: 'Una sesión corta de 20 a 30 minutos ya cuenta y rompe la pausa. Lo difícil es empezar.' })
      else if (since >= 3 && !todayDay?.rest) out.push({ icon: 'spark', kind: 'tip', title: `Llevas ${since} días sin entrenar`, ...go,
        text: 'Hoy es buen día para volver. Mejor una sesión sencilla que ninguna.' })
    }

    // 3. Semana
    out.push({ icon: 'chart', kind: weekDays >= target ? 'ok' : 'tip', title: `Tu semana: ${weekDays} de ${target} entrenos`,
      bar: Math.min(100, Math.round((weekDays / target) * 100)),
      text: weekDays >= target ? 'Meta semanal cumplida. Usa el resto de la semana para recuperar.'
        : `Te faltan ${target - weekDays}. ${daysLeft > 0 ? `Quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} después de hoy.` : 'Hoy es el último día de la semana.'}` })
    if (weekDays > target + 1 && target < 7) out.push({ icon: 'alert', kind: 'warn', title: 'Estás entrenando de más',
      text: `Llevas ${weekDays} entrenos y tu meta es ${target}. Más no siempre es mejor: si notas cansancio o dolor, mete un día de descanso.` })

    // 4. Racha
    const st = streaks(dayKeys, pr ? pr.days.map(d => d.rest) : [])
    if (st.cur >= 2) out.push({ icon: 'flame', kind: 'ok', title: `Racha de ${st.cur} días`, text: `Tu mejor racha es de ${st.best}. Los días de descanso de tu plan no la rompen.` })

    // 5. Técnica
    const recent = muscles(weekSess)
    const planG = todayDay && !todayDay.rest ? Array.from(new Set(todayDay.exercises.map(e => groupOf(e.name)).filter(Boolean) as string[])) : []
    const gl = recent.length ? recent : planG
    if (gl.length) {
      const doy = Math.floor((today0.getTime() - new Date(today0.getFullYear(), 0, 0).getTime()) / DAY)
      const g = gl[doy % gl.length]
      out.push({ icon: 'bulb', kind: 'tip', title: `Técnica: ${MUSCLE[g]}`, text: TECH[g][doy % TECH[g].length] })
    }

    // 6. Progreso del mes
    if (sess.length > 0) {
      const d30 = new Date(today0.getTime() - 30 * DAY)
      const s30 = sess.filter(s => new Date(s.completed_at) >= d30)
      const days30 = new Set(s30.map(s => keyOf(new Date(s.completed_at)))).size
      const expected = Math.max(1, Math.round((target * 30) / 7))
      const by = new Map<string, number[]>()
      logs.filter(l => Number(l.weight_kg) > 0 && new Date(l.logged_at) >= d30)
        .forEach(l => by.set(l.exercise, [...(by.get(l.exercise) ?? []), Number(l.weight_kg)]))
      let up = 0
      by.forEach(v => { if (v.length > 1 && v[v.length - 1] > v[0]) up++ })
      const w30 = weights.filter(w => new Date(w.logged_at) >= d30)
      const dw = w30.length > 1 ? Number(w30[w30.length - 1].weight_kg) - Number(w30[0].weight_kg) : null
      const firstDays = Math.floor((today0.getTime() - startOf(new Date(sess[0].completed_at)).getTime()) / DAY)

      const bits = [`${days30} de unos ${expected} entrenos esperados en 30 días.`]
      if (up > 0) bits.push(`Subiste la carga en ${up} ejercicio${up === 1 ? '' : 's'}.`)
      if (dw !== null && dw !== 0) bits.push(`Tu peso ${dw > 0 ? 'subió' : 'bajó'} ${Math.abs(Math.round(dw * 10) / 10)} kg.`)
      if (pr) bits.push(`Vas en la semana ${pr.weekNumber} de ${pr.total} de tu ciclo; termina en ${Math.max(0, Math.ceil((pr.end.getTime() - now.getTime()) / DAY))} días.`)
      if (firstDays < 7) bits.push('Llevas pocos días: con 4 semanas de constancia verás cambios más claros.')
      out.push({ icon: 'chart', kind: days30 / expected >= 0.7 ? 'ok' : 'tip', title: 'Tu progreso del mes',
        bar: Math.min(100, Math.round((days30 / expected) * 100)), text: bits.join(' ') })
    }

    // 7. Peso
    const lw = weights[weights.length - 1]
    const wDays = lw ? Math.floor((today0.getTime() - startOf(new Date(lw.logged_at)).getTime()) / DAY) : null
    if (wDays === null || wDays > 14) out.push({ icon: 'weight', kind: 'tip', title: 'Actualiza tu peso',
      text: wDays === null ? 'Aún no registras tu peso. Anótalo para ver tu progreso.' : `Tu último peso fue hace ${wDays} días. Pésate cada 1 o 2 semanas, en condiciones parecidas.`,
      to: '/app/mas/cuenta', cta: 'Registrar' })

    // 8. Molestia con ajustes
    if (inj.mode === 'adjust') out.push({ icon: 'shield', kind: 'warn', title: 'Entrenas con ajustes',
      text: 'Evita los ejercicios que cargan tu zona con molestia, baja la carga y para si el dolor sube. Revisa qué ejercicios sí puedes hacer.', to: '/app/lesiones', cta: 'Ver ejercicios' })

    return out
  }, [sess, logs, weights, plan, inj.mode, profile?.days_per_week])

  if (!sess) return null
  return (
    <>
      <h2 className="section">Tu ayudante</h2>
      <p className="hint" style={{ marginTop: 0 }}>Consejos y seguimiento según lo que has entrenado.</p>
      <div className="hscroll">
        {cards.map((c, i) => (
          <div className={`coach-c ${c.kind}`} key={i}>
            <span className="coach-ic"><Icon name={c.icon} size={20} /></span>
            <b>{c.title}</b>
            {c.bar !== undefined && <div className="hbar"><i style={{ width: `${c.bar}%` }} /></div>}
            <p>{c.text}</p>
            {c.to && <Link to={c.to} state={c.state} className="btn-ver">{c.cta ?? 'Ver'}</Link>}
          </div>
        ))}
      </div>
      <p className="hint">Mensajes automáticos basados en tus registros; no sustituyen a un entrenador ni a un médico.</p>
    </>
  )
}