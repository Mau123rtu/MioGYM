import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATALOG, groupOf, type Plan } from '../lib/routine'
import { streaks, StreakCard, type Sess } from '../components/Streak'
import Icon from '../components/Icons'

interface Log { exercise: string; weight_kg: number; reps: number | null; logged_at: string }


const MUSCLE: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}
const keyOf = (d: Date) => d.toLocaleDateString('en-CA')
const dayKey = (iso: string) => keyOf(new Date(iso))
const label = (n: string) => n.split(' · ').slice(1).join(' · ') || n
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es')
const dur = (s: number) => {
  if (s <= 0) return '0 min'
  if (s < 60) return `${Math.round(s)} s`
  const mins = Math.round(s / 60)
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

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

function Bars({ items }: { items: [string, number][] }) {
  const max = Math.max(1, ...items.map(i => i[1]))
  if (items.length === 0) return <p className="hint">Sin datos de tiempo todavía.</p>
  return (
    <div className="card">
      {items.map(([n, v]) => (
        <div className="brow" key={n}>
          <div className="top"><span>{n}</span><b>{dur(v)}</b></div>
          <div className="hbar"><i style={{ width: `${(v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

const GROUP_ORDER = ['Pecho', 'Espalda', 'Hombros', 'Bíceps y tríceps', 'Piernas y glúteos', 'Abdomen', 'Otras rutinas', 'Otros']

function groupBy<T>(items: T[], f: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>()
  items.forEach(i => { const k = f(i); m.set(k, [...(m.get(k) ?? []), i]) })
  return [...m.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
}

const KEYWORDS: [string, string][] = [
  ['pecho', 'Pecho'], ['empuje', 'Pecho'], ['espalda', 'Espalda'], ['tirón', 'Espalda'], ['tiron', 'Espalda'],
  ['hombro', 'Hombros'], ['brazo', 'Bíceps y tríceps'], ['bíceps', 'Bíceps y tríceps'], ['pierna', 'Piernas y glúteos'],
  ['glúteo', 'Piernas y glúteos'], ['abdom', 'Abdomen'], ['torso', 'Pecho'],
]

function Group({ title, count, open, onToggle, children }: {
  title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="grp">
      <button className="grp-h" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span><small>{count}</small><Icon name={open ? 'up' : 'down'} size={18} />
      </button>
      {open && <div className="grp-b">{children}</div>}
    </div>
  )
}

export default function History() {
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [sess, setSess] = useState<Sess[]>([])
  const [rest, setRest] = useState<boolean[]>([])
  const [view, setView] = useState<'racha' | 'rutinas' | 'ejercicios' | 'tiempo'>('racha')
  const [open, setOpen] = useState<string | null>(null)
  const [openG, setOpenG] = useState<Record<string, boolean>>({})
  const tg = (k: string) => setOpenG(o => ({ ...o, [k]: !o[k] }))

  useEffect(() => {
    supabase.from('workout_logs').select('exercise,weight_kg,reps,logged_at').order('logged_at', { ascending: true }).limit(5000)
      .then(({ data }) => setLogs((data as Log[]) ?? []))
    supabase.from('workout_sessions').select('*').order('completed_at', { ascending: false }).limit(1000)
      .then(({ data }) => setSess((data as Sess[]) ?? []))
    supabase.from('routines').select('plan').maybeSingle().then(({ data }) => {
      const p = data?.plan as Plan | undefined
      setRest(p && p.days.length === 7 ? p.days.map(d => d.rest) : [])
    })
  }, [])

  const keys = useMemo(() => new Set(sess.map(s => dayKey(s.completed_at))), [sess])
  const st = useMemo(() => streaks(keys, rest), [keys, rest])
  
  

  const timeStats = useMemo(() => {
    const routine: Record<string, number> = {}, muscle: Record<string, number> = {}, exercise: Record<string, number> = {}
    let total = 0
    sess.forEach(s => {
      const d = s.duration_sec ?? 0
      total += d
      const k = label(s.day_name)
      routine[k] = (routine[k] ?? 0) + d
      Object.entries(s.ex_seconds ?? {}).forEach(([n, v]) => {
        exercise[n] = (exercise[n] ?? 0) + v
        const g = groupOf(n)
        if (g) muscle[MUSCLE[g]] = (muscle[MUSCLE[g]] ?? 0) + v
      })
    })
    const sort = (o: Record<string, number>) => Object.entries(o).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1])
    return { total, routine: sort(routine), muscle: sort(muscle), exercise: sort(exercise), exMap: exercise }
  }, [sess])

    const routines = useMemo(() => {
    const m = new Map<string, { count: number; last: string; sets: number; sec: number; mus: Record<string, number> }>()
    sess.forEach(s => {
      const k = label(s.day_name)
      const c = m.get(k) ?? { count: 0, last: s.completed_at, sets: 0, sec: 0, mus: {} }
      c.count++; c.sets += s.sets_done || 0; c.sec += s.duration_sec ?? 0
      Object.entries(s.ex_seconds ?? {}).forEach(([n, v]) => {
        const g = groupOf(n)
        if (g) c.mus[MUSCLE[g]] = (c.mus[MUSCLE[g]] ?? 0) + v
      })
      if (s.completed_at > c.last) c.last = s.completed_at
      m.set(k, c)
    })
    return [...m.entries()].map(([name, r]) => {
      const top = Object.entries(r.mus).sort((a, b) => b[1] - a[1])[0]
      const low = name.toLowerCase()
      const group = top?.[0] ?? KEYWORDS.find(([w]) => low.includes(w))?.[1] ?? 'Otras rutinas'
      return [name, { ...r, group }] as const
    }).sort((a, b) => b[1].count - a[1].count)
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
      const byD = [...days.values()]
      const maxW = Math.max(...ls.map(l => Number(l.weight_kg)))
      const body = maxW === 0
      const metric = byD.map(d => (body ? d.maxR : d.maxW))
      const best = ls.filter(l => Number(l.weight_kg) === maxW).sort((a, b) => (b.reps ?? 0) - (a.reps ?? 0))[0]
      const volume = ls.reduce((a, l) => a + (l.reps ? Number(l.weight_kg) * l.reps : 0), 0)
      return {
        name, times: byD.length, sets: ls.length, maxW, body, best, volume, byDay: byD, metric,
        delta: metric.length > 1 ? metric[metric.length - 1] - metric[0] : null,
      }
    }).sort((a, b) => b.times - a.times)
  }, [logs])

  if (logs === null) return <p className="center">Cargando...</p>
  if (logs.length === 0 && sess.length === 0)
    return <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no hay entrenamientos. Cuando completes una rutina completa, aquí verás tu racha, tu calendario y tu progreso.</p></div>

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{sess.length}</b><small>Entrenos</small></div>
        <div className="stat"><b>{st.cur}</b><small>Racha (días)</small></div>
        <div className="stat"><b>{dur(timeStats.total)}</b><small>Tiempo total</small></div>
      </div>

      <div className="tabs sub">
        <button className={view === 'racha' ? 'on' : ''} onClick={() => setView('racha')}>Racha</button>
        <button className={view === 'rutinas' ? 'on' : ''} onClick={() => setView('rutinas')}>Rutinas</button>
        <button className={view === 'ejercicios' ? 'on' : ''} onClick={() => setView('ejercicios')}>Ejercicios</button>
        <button className={view === 'tiempo' ? 'on' : ''} onClick={() => setView('tiempo')}>Tiempo</button>
      </div>

      {view === 'racha' && <StreakCard cur={st.cur} best={st.best} />}

            {view === 'rutinas' && (
        <>
          {routines.length === 0 && <p className="hint">Termina un entrenamiento completo para ver tus rutinas aquí.</p>}
          {groupBy([...routines], ([, r]) => r.group).map(([g, items]) => (
            <Group key={g} title={g} count={items.length} open={!!openG[`r:${g}`]} onToggle={() => tg(`r:${g}`)}>
              {items.map(([name, r]) => (
                <div className="card" key={name}>
                  <div className="hrow"><h3 style={{ margin: 0 }}>{name}</h3><span className="count">{r.count}×</span></div>
                  <p className="hint" style={{ margin: '.3rem 0 0' }}>
                    Realizada {r.count} {r.count === 1 ? 'vez' : 'veces'} · última: {fmtDate(r.last)}{r.sets > 0 && ` · ${r.sets} series`}
                  </p>
                  {r.sec > 0 && <p className="hint" style={{ margin: '.2rem 0 0' }}>Tiempo total: {dur(r.sec)} · promedio: {dur(r.sec / r.count)}</p>}
                </div>
              ))}
            </Group>
          ))}
          {sess.length > 0 && (
            <>
              <h3 style={{ marginTop: '1.2rem' }}>Últimos entrenos</h3>
              <div className="card" style={{ padding: '.3rem 1rem' }}>
                {sess.slice(0, 5).map(s => (
                  <p key={s.id} className="logrow">
                    <span>{fmtDate(s.completed_at)} · {label(s.day_name)}</span>
                    <b>{s.duration_sec ? dur(s.duration_sec) : '–'}</b>
                  </p>
                ))}
              </div>
            </>
          )}
        </>
      )}

            {view === 'ejercicios' && groupBy(exercises, e => {
        const g = CATALOG.find(c => c.n === e.name)?.g
        return g ? MUSCLE[g] : 'Otros'
      }).map(([grp, items]) => (
        <Group key={grp} title={grp} count={items.length} open={!!openG[`e:${grp}`]} onToggle={() => tg(`e:${grp}`)}>
          {items.map(e => {
            const unit = e.body ? 'rep' : 'kg'
            const isOpen = open === e.name
            const t = timeStats.exMap[e.name] ?? 0
            return (
              <div className="card" key={e.name}>
                <button className="hbtn" onClick={() => setOpen(isOpen ? null : e.name)}>
                  <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <b>{e.name}</b>
                    <small className="hint" style={{ display: 'block' }}>
                      {e.times} {e.times === 1 ? 'vez' : 'veces'} · {e.body ? `mejor: ${e.best?.reps ?? 0} reps` : `máx: ${num(e.maxW)} kg`}{t > 0 && ` · ${dur(t)}`}
                    </small>
                  </div>
                  {e.delta === null ? <span className="pill">Nuevo</span>
                    : e.delta > 0 ? <span className="pill up">▲ +{num(e.delta)} {unit}</span>
                    : e.delta < 0 ? <span className="pill down">▼ {num(e.delta)} {unit}</span>
                    : <span className="pill">= Sin cambio</span>}
                </button>

                {isOpen && (
                  <div style={{ marginTop: '.8rem' }}>
                    <div className="kv">
                      <div><small>Peso máximo</small><b>{e.body ? 'Peso corporal' : `${num(e.maxW)} kg`}</b></div>
                      <div><small>Mejor serie</small><b>{e.body ? `${e.best?.reps ?? 0} reps` : `${num(e.maxW)} × ${e.best?.reps ?? '–'}`}</b></div>
                      <div><small>Series totales</small><b>{e.sets}</b></div>
                      <div><small>Tiempo entrenado</small><b>{t > 0 ? dur(t) : '–'}</b></div>
                      <div><small>Volumen</small><b>{e.volume > 0 ? `${Math.round(e.volume).toLocaleString('es')} kg` : '–'}</b></div>
                      <div><small>Primer → último</small><b>{num(e.metric[0])} → {num(e.metric[e.metric.length - 1])} {unit}</b></div>
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
        </Group>
      ))}

      {view === 'tiempo' && (
        <>
          <div className="kv" style={{ marginBottom: '1rem' }}>
            <div><small>Rutina con más tiempo</small><b>{timeStats.routine[0]?.[0] ?? '–'}</b></div>
            <div><small>Músculo con más tiempo</small><b>{timeStats.muscle[0]?.[0] ?? '–'}</b></div>
            <div style={{ gridColumn: '1 / -1' }}><small>Ejercicio con más tiempo</small><b>{timeStats.exercise[0]?.[0] ?? '–'}</b></div>
          </div>
          <h3>Por rutina</h3>
          <Bars items={timeStats.routine} />
          <h3>Por músculo</h3>
          <Bars items={timeStats.muscle} />
          <h3>Por ejercicio</h3>
          <Bars items={timeStats.exercise.slice(0, 12)} />
          <p className="hint">El tiempo se registra desde que empiezas una rutina completa; incluye los descansos entre series. Las rutinas guardadas antes de esta actualización no tienen datos de tiempo.</p>
        </>
      )}
    </>
  )
}