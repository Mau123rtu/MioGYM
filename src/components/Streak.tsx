import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Plan } from '../lib/routine'
import Icon from './Icons'

export interface Sess {
  id: number; day_name: string; completed_at: string; sets_done: number
  duration_sec: number | null; ex_seconds: Record<string, number> | null
}

const keyOf = (d: Date) => d.toLocaleDateString('en-CA')
const dayKey = (iso: string) => keyOf(new Date(iso))
const label = (n: string) => n.split(' · ').slice(1).join(' · ') || n
const dur = (s: number) => {
  if (s <= 0) return '0 min'
  if (s < 60) return `${Math.round(s)} s`
  const mins = Math.round(s / 60)
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

/** Racha: los días de descanso del plan no la rompen */
export function streaks(keys: Set<string>, rest: boolean[]) {
  if (keys.size === 0) return { cur: 0, best: 0 }
  const first = [...keys].sort()[0]
  const d = new Date(`${first}T00:00:00`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayKey = keyOf(today)
  let cur = 0, best = 0
  while (d <= today) {
    const k = keyOf(d), idx = (d.getDay() + 6) % 7
    if (keys.has(k)) cur++
    else if (!rest[idx] && k !== todayKey) cur = 0
    best = Math.max(best, cur)
    d.setDate(d.getDate() + 1)
  }
  return { cur, best }
}

/** Carga sesiones y días de descanso del plan, y calcula la racha */
export function useTrainingData() {
  const [sess, setSess] = useState<Sess[]>([])
  const [rest, setRest] = useState<boolean[]>([])

  useEffect(() => {
    supabase.from('workout_sessions').select('*').order('completed_at', { ascending: false }).limit(1000)
      .then(({ data }) => setSess((data as Sess[]) ?? []))
    supabase.from('routines').select('plan').maybeSingle().then(({ data }) => {
      const p = data?.plan as Plan | undefined
      setRest(p && p.days.length === 7 ? p.days.map(d => d.rest) : [])
    })
  }, [])

  const keys = useMemo(() => new Set(sess.map(s => dayKey(s.completed_at))), [sess])
  const st = useMemo(() => streaks(keys, rest), [keys, rest])
  return { sess, rest, keys, st }
}

/** Tarjeta de racha */
export function StreakCard({ cur, best }: { cur: number; best: number }) {
  return (
    <div className="card streak">
      <span className="big">{cur}</span>
      <div>
        <b>{cur === 1 ? 'día de racha' : 'días de racha'}</b>
        <p className="hint" style={{ margin: '.2rem 0 0' }}>Mejor racha: {best}. Los días de descanso no la rompen.</p>
      </div>
    </div>
  )
}

/** Calendario mensual con días entrenados, descanso y detalle del día elegido */
export function Calendar({ keys, rest, sess }: { keys: Set<string>; rest: boolean[]; sess: Sess[] }) {
  const [m, setM] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [sel, setSel] = useState(keyOf(new Date()))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayKey = keyOf(today)
  const offset = (m.getDay() + 6) % 7
  const n = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
  const hasPlan = rest.length === 7

  const sd = new Date(`${sel}T00:00:00`)
  const selSess = sess.filter(s => dayKey(s.completed_at) === sel)
  const selRest = hasPlan && rest[(sd.getDay() + 6) % 7]

  return (
    <>
      <div className="cal-head">
        <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Mes anterior">‹</button>
        <b style={{ textTransform: 'capitalize' }}>{m.toLocaleDateString('es', { month: 'long', year: 'numeric' })}</b>
        <button onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cal">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => <span className="dow" key={d}>{d}</span>)}
        {Array.from({ length: offset }).map((_, i) => <span key={`e${i}`} className="cal-day empty" />)}
        {Array.from({ length: n }).map((_, i) => {
          const d = new Date(m.getFullYear(), m.getMonth(), i + 1)
          const k = keyOf(d), idx = (d.getDay() + 6) % 7
          const trained = keys.has(k)
          const isRest = hasPlan && rest[idx]
          const isToday = k === todayKey
          const missed = !trained && !isRest && d < today
          return (
            <button key={k} onClick={() => setSel(k)}
              className={`cal-day${trained ? ' tr' : ''}${!trained && isRest ? ' rs' : ''}${missed ? ' miss' : ''}${isToday ? ' today' : ''}${sel === k ? ' sel' : ''}`}>
              <b>{i + 1}</b>
              {trained ? <Icon name="check" size={12} /> : isRest ? <small>Descanso</small> : null}
            </button>
          )
        })}
      </div>

      <div className="legend">
        <span><i className="lg tr" />Entrenado</span>
        <span><i className="lg rs" />Descanso</span>
        <span><i className="lg miss" />Sin entreno</span>
      </div>

      <div className="card">
        <h3 style={{ textTransform: 'capitalize' }}>{sd.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        {selSess.length > 0 ? selSess.map(s => (
          <p key={s.id} className="logrow"><span>{label(s.day_name)}</span><b>{s.duration_sec ? dur(s.duration_sec) : `${s.sets_done} series`}</b></p>
        )) : selRest ? <p className="hint" style={{ margin: 0 }}>Día de descanso. Recuperarte también es parte del plan.</p>
          : sd > today ? <p className="hint" style={{ margin: 0 }}>Aún no llega este día.</p>
          : <p className="hint" style={{ margin: 0 }}>No registraste entrenamiento este día.</p>}
      </div>
    </>
  )
}

/** Ventana con la racha y el calendario */
export function CalendarModal({ onClose, data }: { onClose: () => void; data: ReturnType<typeof useTrainingData> }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Calendario de entrenamientos">
        <div className="modal-top">
          <h2 style={{ margin: 0 }}>Calendario</h2>
          <button className="mini-ic" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={18} /></button>
        </div>
        <StreakCard cur={data.st.cur} best={data.st.best} />
        <Calendar keys={data.keys} rest={data.rest} sess={data.sess} />
      </div>
    </div>
  )
}