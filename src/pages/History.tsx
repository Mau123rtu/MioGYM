import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATALOG, groupOf, type Plan } from '../lib/routine'
import { streaks, StreakCard, type Sess } from '../components/Streak'
import Icon from '../components/Icons'
interface Walk { id: number; duration_sec: number; mode: string; created_at: string }

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

// ACA VA

interface DaySets { key: string; at: string; sets: { kg: number; reps: number | null }[]; best: { kg: number; reps: number } }

function ProgressChart({ pts, body, sel, onSel }: {
  pts: { label: string; kg: number; reps: number }[]; body: boolean; sel: number; onSel: (i: number) => void
}) {
  const W = 330, H = 190, L = 38, R = 38, T = 14, B = 28
  const n = pts.length
  const x = (i: number) => (n === 1 ? (W - L - R) / 2 + L : L + (i / (n - 1)) * (W - L - R))
  const scale = (vals: number[]) => {
    let lo = Math.min(...vals), hi = Math.max(...vals)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.15
    lo = Math.max(0, lo - pad); hi += pad
    return { lo, hi, y: (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B) }
  }
  const sk = scale(pts.map(p => p.kg))
  const sr = scale(pts.map(p => p.reps))
  const yReps = body ? sr : sr
  const line = (f: (p: (typeof pts)[number]) => number, s: ReturnType<typeof scale>) =>
    pts.map((p, i) => `${x(i)},${s.y(f(p))}`).join(' ')
  const ticks = (s: ReturnType<typeof scale>) => [s.lo, (s.lo + s.hi) / 2, s.hi]
  const fmtT = (v: number) => String(Math.round(v * 10) / 10)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pchart" role="img" aria-label="Progreso de peso y repeticiones">
      {ticks(body ? yReps : sk).map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={(body ? yReps : sk).y(v)} y2={(body ? yReps : sk).y(v)} stroke="#2a2a2a" strokeWidth="1" />
          <text x={L - 6} y={(body ? yReps : sk).y(v) + 3} textAnchor="end" fontSize="9" fill={body ? '#f5f5f5' : '#ffd400'}>{fmtT(v)}</text>
        </g>
      ))}
      {!body && ticks(yReps).map((v, i) => (
        <text key={i} x={W - R + 6} y={yReps.y(v) + 3} fontSize="9" fill="#f5f5f5">{fmtT(v)}</text>
      ))}

      {!body && n > 1 && <polyline points={line(p => p.kg, sk)} fill="none" stroke="#ffd400" strokeWidth="2.5" strokeLinejoin="round" />}
      {n > 1 && <polyline points={line(p => p.reps, yReps)} fill="none" stroke="#f5f5f5" strokeWidth="2" strokeDasharray={body ? undefined : '5 4'} strokeLinejoin="round" />}

      {pts.map((p, i) => (
        <g key={i} onClick={() => onSel(i)} style={{ cursor: 'pointer' }}>
          <rect x={x(i) - 14} y={T} width="28" height={H - T - B} fill="transparent" />
          {sel === i && <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} stroke="#ffd400" strokeWidth="1" strokeDasharray="3 3" />}
          {!body && <circle cx={x(i)} cy={sk.y(p.kg)} r={sel === i ? 6 : 4} fill="#ffd400" />}
          <rect x={x(i) - (sel === i ? 5 : 3.5)} y={yReps.y(p.reps) - (sel === i ? 5 : 3.5)} width={sel === i ? 10 : 7} height={sel === i ? 10 : 7} fill="#f5f5f5" />
        </g>
      ))}

      <text x={x(0)} y={H - 8} fontSize="9" fill="#8d8d8d" textAnchor={n === 1 ? 'middle' : 'start'}>{pts[0].label}</text>
      {n > 1 && <text x={x(n - 1)} y={H - 8} fontSize="9" fill="#8d8d8d" textAnchor="end">{pts[n - 1].label}</text>}
    </svg>
  )
}

function ExerciseDetail({ name, logs, onBack }: { name: string; logs: Log[]; onBack: () => void }) {
  const g = CATALOG.find(c => c.n === name)?.g
  const days = useMemo(() => {
    const m = new Map<string, DaySets>()
    logs.filter(l => l.exercise === name).forEach(l => {
      const k = dayKey(l.logged_at)
      const d = m.get(k) ?? { key: k, at: l.logged_at, sets: [], best: { kg: 0, reps: 0 } }
      const kg = Number(l.weight_kg), reps = l.reps ?? 0
      d.sets.push({ kg, reps: l.reps })
      if (kg > d.best.kg || (kg === d.best.kg && reps > d.best.reps)) d.best = { kg, reps }
      m.set(k, d)
    })
    return [...m.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
  }, [logs, name])

  const body = days.length > 0 && days.every(d => d.best.kg === 0)
  const pts = days.slice(-15).map(d => ({ label: fmtDate(d.at), kg: d.best.kg, reps: d.best.reps }))
  const [sel, setSel] = useState(Math.max(0, pts.length - 1))
  const cur = pts[Math.min(sel, pts.length - 1)]

  const first = pts[0], lastP = pts[pts.length - 1]
  const dKg = lastP.kg - first.kg, dReps = lastP.reps - first.reps
  const trend = (d: number, unit: string) => (d > 0 ? `subió +${num(d)} ${unit}` : d < 0 ? `bajó ${num(d)} ${unit}` : `sin cambio en ${unit}`)
  const maxKg = Math.max(...days.map(d => d.best.kg))
  const totalSets = days.reduce((a, d) => a + d.sets.length, 0)

  return (
    <>
      <button className="back" onClick={onBack}>← Ejercicios</button>
      {g && <p className="hint" style={{ margin: 0 }}>{MUSCLE[g]}</p>}
      <h2>{name}</h2>

      <div className="kv" style={{ marginBottom: '1rem' }}>
        <div><small>Veces realizado</small><b>{days.length}</b></div>
        <div><small>Series totales</small><b>{totalSets}</b></div>
        <div><small>{body ? 'Mejor serie' : 'Peso máximo'}</small><b>{body ? `${Math.max(...days.map(d => d.best.reps))} reps` : `${num(maxKg)} kg`}</b></div>
        <div><small>Último registro</small><b>{body ? `${lastP.reps} reps` : `${num(lastP.kg)} kg × ${lastP.reps}`}</b></div>
      </div>

      <h3>Progreso</h3>
      <div className="card">
        <div className="legend" style={{ marginTop: 0 }}>
          {!body && <span><i className="lg" style={{ background: '#ffd400', borderColor: '#ffd400', borderRadius: '50%' }} />Peso (kg)</span>}
          <span><i className="lg" style={{ background: '#f5f5f5', borderColor: '#f5f5f5' }} />Repeticiones con ese peso</span>
        </div>
        <ProgressChart pts={pts} body={body} sel={Math.min(sel, pts.length - 1)} onSel={setSel} />
        <div className="psel">
          <small>{cur.label}</small>
          <b>{body ? `${cur.reps} repeticiones` : `${num(cur.kg)} kg × ${cur.reps} reps`}</b>
        </div>
        {pts.length > 1 ? (
          <p className="hint" style={{ margin: '.6rem 0 0' }}>
            Desde {first.label}: {!body && <>el peso {trend(dKg, 'kg')} y </>}{body ? 'las repeticiones ' : 'las repeticiones '}{trend(dReps, 'reps')}.
          </p>
        ) : <p className="hint" style={{ margin: '.6rem 0 0' }}>Con más entrenamientos verás aquí si subes o bajas.</p>}
      </div>

      <h3 style={{ marginTop: '1.2rem' }}>Cuándo lo hiciste</h3>
      {[...days].reverse().map((d, i, arr) => {
        const prev = arr[i + 1]
        const dw = prev ? d.best.kg - prev.best.kg : null
        const dr = prev ? d.best.reps - prev.best.reps : null
        const diff = dw !== null && (body ? dr : dw)
        return (
          <div className="card" key={d.key}>
            <div className="hrow">
              <div>
                <b style={{ textTransform: 'capitalize' }}>{new Date(d.at).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
                <small className="hint" style={{ display: 'block' }}>{d.sets.length} {d.sets.length === 1 ? 'serie' : 'series'}</small>
              </div>
              {prev ? (diff && diff > 0 ? <span className="pill up">▲ Mejoró</span> : diff && diff < 0 ? <span className="pill down">▼ Bajó</span> : <span className="pill">= Igual</span>) : <span className="pill">Primera vez</span>}
            </div>
            <div style={{ marginTop: '.5rem' }}>
              {d.sets.map((s, k) => (
                <span className="tag" key={k}>{k + 1}ª · {s.kg > 0 ? `${num(s.kg)} kg × ${s.reps ?? '–'}` : `${s.reps ?? '–'} reps`}</span>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

//ACA ACABA SEGUN 

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
  const [view, setView] = useState<'racha' | 'rutinas' | 'ejercicios' | 'tiempo' | 'caminatas'>('racha')
  const [walks, setWalks] = useState<Walk[]>([])
  const [selEx, setSelEx] = useState<string | null>(null)
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
          supabase.from('walk_logs').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setWalks((data as Walk[]) ?? []))
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

    if (selEx) return <ExerciseDetail name={selEx} logs={logs} onBack={() => setSelEx(null)} />
    
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
                <button className={view === 'caminatas' ? 'on' : ''} onClick={() => setView('caminatas')}>Caminatas</button>
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
          <div className="egrid">
            {items.map(e => {
              const unit = e.body ? 'rep' : 'kg'
              return (
                <button className="etile" key={e.name} onClick={() => { setSelEx(e.name); window.scrollTo(0, 0) }}>
                  <b>{e.name}</b>
                  <small>{e.times} {e.times === 1 ? 'vez' : 'veces'}</small>
                  <small>{e.body ? `Mejor: ${e.best?.reps ?? 0} reps` : `Máx: ${num(e.maxW)} kg`}</small>
                  {e.delta === null ? <span className="pill">Nuevo</span>
                    : e.delta > 0 ? <span className="pill up">▲ +{num(e.delta)} {unit}</span>
                    : e.delta < 0 ? <span className="pill down">▼ {num(e.delta)} {unit}</span>
                    : <span className="pill">= Sin cambio</span>}
                </button>
              )
            })}
          </div>
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

            {view === 'caminatas' && (
        <>
          <div className="kv" style={{ marginBottom: '1rem' }}>
            <div><small>Caminatas</small><b>{walks.length}</b></div>
            <div><small>Tiempo total</small><b>{dur(walks.reduce((a, w) => a + w.duration_sec, 0))}</b></div>
          </div>
          {walks.length === 0 && <div className="card"><p className="hint" style={{ margin: 0 }}>Aún no hay caminatas. Al terminar una rutina completa te sugeriremos una, de forma opcional.</p></div>}
          {walks.length > 0 && (
            <div className="card" style={{ padding: '.3rem 1rem' }}>
              {walks.map(w => (
                <p key={w.id} className="logrow">
                  <span style={{ textTransform: 'capitalize' }}>
                    {new Date(w.created_at).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })}
                    {' · '}{w.mode === 'caminadora' ? 'Caminadora' : 'Caminata'}
                  </span>
                  <b>{dur(w.duration_sec)}</b>
                </p>
              ))}
            </div>
          )}
        </>
      )}

    </>
  )
}