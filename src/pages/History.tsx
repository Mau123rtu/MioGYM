import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATALOG } from '../lib/routine'

interface Log { exercise: string; weight_kg: number; reps: number | null; logged_at: string }
interface Sess { id: number; day_name: string; completed_at: string; sets_done: number }

const MUSCLE: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA')
const label = (n: string) => n.split(' · ').slice(1).join(' · ') || n
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es')

function Spark({ v }: { v: number[] }) {
  if (v.length < 2) return null
  const w = 260, h = 64
  const max = Math.max(...v), min = Math.min(...v), r = max - min || 1
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (w - 10) + 5, h - 8 - ((x - min) / r) * (h - 16)])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none">
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="#ffd400" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#ffd400" />)}
    </svg>
  )
}

export default function History() {
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [sess, setSess] = useState<Sess[]>([])
  const [view, setView] = useState<'rutinas' | 'ejercicios'>('rutinas')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('workout_logs').select('exercise,weight_kg,reps,logged_at').order('logged_at', { ascending: true }).limit(5000)
      .then(({ data }) => setLogs((data as Log[]) ?? []))
    supabase.from('workout_sessions').select('*').order('completed_at', { ascending: false }).limit(1000)
      .then(({ data }) => setSess((data as Sess[]) ?? []))
  }, [])

  const routines = useMemo(() => {
    const m = new Map<string, { count: number; last: string; sets: number }>()
    sess.forEach(s => {
      const k = label(s.day_name)
      const c = m.get(k) ?? { count: 0, last: s.completed_at, sets: 0 }
      c.count++; c.sets += s.sets_done || 0
      if (s.completed_at > c.last) c.last = s.completed_at
      m.set(k, c)
    })
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [sess])

  const exercises = useMemo(() => {
    const m = new Map<string, Log[]>()
    ;(logs ?? []).forEach(l => m.set(l.exercise, [...(m.get(l.exercise) ?? []), l]))
    return [...m.entries()].map(([name, ls]) => {
      const days = new Map<string, { maxW: number; maxR: number; sets: number; at: string }>()
      ls.forEach(l => {
        const k = dayKey(l.logged_at)
        const d = days.get(k) ?? { maxW: 0, maxR: 0, sets: 0, at: l.logged_at }
        d.maxW = Math.max(d.maxW, Number(l.weight_kg)); d.maxR = Math.max(d.maxR, l.reps ?? 0); d.sets++
        days.set(k, d)
      })
      const byDay = [...days.values()]
      const maxW = Math.max(...ls.map(l => Number(l.weight_kg)))
      const body = maxW === 0
      const metric = byDay.map(d => (body ? d.maxR : d.maxW))
      const best = ls.filter(l => Number(l.weight_kg) === maxW).sort((a, b) => (b.reps ?? 0) - (a.reps ?? 0))[0]
      const volume = ls.reduce((a, l) => a + (l.reps ? Number(l.weight_kg) * l.reps : 0), 0)
      return {
        name, times: byDay.length, sets: ls.length, maxW, body, best, volume, byDay, metric,
        delta: metric.length > 1 ? metric[metric.length - 1] - metric[0] : null,
        last: byDay[byDay.length - 1].at,
      }
    }).sort((a, b) => b.times - a.times)
  }, [logs])

  if (logs === null) return <p className="center">Cargando...</p>
  if (logs.length === 0 && sess.length === 0)
    return <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no hay entrenamientos. Cuando marques series y termines una sesión, aquí verás tu progreso.</p></div>

  const weekAgo = Date.now() - 7 * 86400000
  const week = sess.filter(s => new Date(s.completed_at).getTime() >= weekAgo).length
  const totalVol = exercises.reduce((a, e) => a + e.volume, 0)

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{sess.length}</b><small>Entrenos</small></div>
        <div className="stat"><b>{week}</b><small>Esta semana</small></div>
        <div className="stat"><b>{totalVol >= 1000 ? `${num(totalVol / 1000)} t` : `${Math.round(totalVol)} kg`}</b><small>Volumen total</small></div>
      </div>

      <div className="tabs sub">
        <button className={view === 'rutinas' ? 'on' : ''} onClick={() => setView('rutinas')}>Rutinas hechas</button>
        <button className={view === 'ejercicios' ? 'on' : ''} onClick={() => setView('ejercicios')}>Ejercicios</button>
      </div>

      {view === 'rutinas' && (
        <>
          {routines.length === 0 && <p className="hint">Termina un entrenamiento para ver tus rutinas aquí.</p>}
          {routines.map(([name, r]) => (
            <div className="card" key={name}>
              <div className="hrow"><h3 style={{ margin: 0 }}>{name}</h3><span className="count">{r.count}×</span></div>
              <p className="hint" style={{ margin: '.3rem 0 0' }}>
                Realizada {r.count} {r.count === 1 ? 'vez' : 'veces'} · última: {fmtDate(r.last)}{r.sets > 0 && ` · ${r.sets} series`}
              </p>
            </div>
          ))}
          {sess.length > 0 && (
            <>
              <h3 style={{ marginTop: '1.2rem' }}>Últimos entrenos</h3>
              <div className="card" style={{ padding: '.3rem 1rem' }}>
                {sess.slice(0, 10).map(s => (
                  <p key={s.id} className="logrow"><span>{fmtDate(s.completed_at)}</span><b>{label(s.day_name)}</b></p>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {view === 'ejercicios' && exercises.map(e => {
        const g = CATALOG.find(c => c.n === e.name)?.g
        const unit = e.body ? 'rep' : 'kg'
        const isOpen = open === e.name
        return (
          <div className="card" key={e.name}>
            <button className="hbtn" onClick={() => setOpen(isOpen ? null : e.name)}>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <b>{e.name}</b>
                <small className="hint" style={{ display: 'block' }}>
                  {e.times} {e.times === 1 ? 'vez' : 'veces'} · {e.body ? `mejor: ${e.best?.reps ?? 0} reps` : `máx: ${num(e.maxW)} kg`}
                </small>
              </div>
              {e.delta === null ? <span className="pill">Nuevo</span>
                : e.delta > 0 ? <span className="pill up">▲ +{num(e.delta)} {unit}</span>
                : e.delta < 0 ? <span className="pill down">▼ {num(e.delta)} {unit}</span>
                : <span className="pill">= Sin cambio</span>}
            </button>

            {isOpen && (
              <div style={{ marginTop: '.8rem' }}>
                {g && <span className="tag">{MUSCLE[g]}</span>}
                <div className="kv">
                  <div><small>Peso máximo</small><b>{e.body ? 'Peso corporal' : `${num(e.maxW)} kg`}</b></div>
                  <div><small>Mejor serie</small><b>{e.body ? `${e.best?.reps ?? 0} reps` : `${num(e.maxW)} × ${e.best?.reps ?? '–'}`}</b></div>
                  <div><small>Series totales</small><b>{e.sets}</b></div>
                  <div><small>Volumen</small><b>{e.volume > 0 ? `${Math.round(e.volume).toLocaleString('es')} kg` : '–'}</b></div>
                  <div><small>Primer registro</small><b>{num(e.metric[0])} {unit}</b></div>
                  <div><small>Último registro</small><b>{num(e.metric[e.metric.length - 1])} {unit}</b></div>
                </div>
                {e.metric.length > 1 && (
                  <>
                    <p className="hint" style={{ margin: '.8rem 0 .2rem' }}>Progreso ({e.body ? 'reps máximas' : 'peso máximo'} por entrenamiento)</p>
                    <Spark v={e.metric.slice(-12)} />
                  </>
                )}
                <p className="hint" style={{ margin: '.8rem 0 .3rem' }}>Últimas sesiones</p>
                {[...e.byDay].reverse().slice(0, 5).map((d, i) => (
                  <p key={i} className="logrow">
                    <span>{fmtDate(d.at)} · {d.sets} {d.sets === 1 ? 'serie' : 'series'}</span>
                    <b>{e.body ? `${d.maxR} reps` : `${num(d.maxW)} kg`}</b>
                  </p>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}