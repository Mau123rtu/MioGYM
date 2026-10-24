import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { groupOf, type PlanDay } from '../lib/routine'
import { howTo } from '../lib/exerciseInfo'
import { buildWarmup, cardioRec, type CardioRec } from '../lib/warmup'
import { BodyMap } from './Body'
import Icon from './Icons'

interface Ctx { day: PlanDay | null; min: boolean; start: (d: PlanDay) => void }
const WorkoutCtx = createContext<Ctx>({ day: null, min: false, start: () => {} })
export const useWorkout = () => useContext(WorkoutCtx)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [day, setDay] = useState<PlanDay | null>(null)
  const [min, setMin] = useState(false)
  const [run, setRun] = useState(0)

  const start = (d: PlanDay) => {
    if (day && !window.confirm('Ya tienes un entrenamiento en curso. ¿Quieres descartarlo y empezar este?')) {
      setMin(false)
      return
    }
    setDay(d); setMin(false); setRun(r => r + 1)
  }

  return (
    <WorkoutCtx.Provider value={{ day, min, start }}>
      {children}
      {day && <Session key={run} day={day} min={min} setMin={setMin} onClose={() => { setDay(null); setMin(false) }} />}
    </WorkoutCtx.Provider>
  )
}

interface Row { kg: string; reps: string; done: boolean }
const repsDefault = (s: string) => parseInt(s.includes('/') ? s.split('/')[1] : s) || 10
const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/* ---------- Caminata final (opcional) ---------- */
function Cooldown({ rec }: { rec: CardioRec }) {
  const { session } = useAuth()
  const [minutes, setMinutes] = useState(rec.suggested)
  const [end, setEnd] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [walked, setWalked] = useState<number | null>(null)
  const [hidden, setHidden] = useState(false)
  const startedAt = useRef(0)

  useEffect(() => {
    if (end === null) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [end])

  // guarda la caminata con los segundos reales
  const finish = async () => {
    const sec = Math.min(Math.round((Date.now() - startedAt.current) / 1000), minutes * 60)
    setEnd(null)
    setWalked(sec)
    if (sec >= 30) {
      await supabase.from('walk_logs').insert({ user_id: session!.user.id, duration_sec: sec, mode: rec.mode })
    }
  }

  const left = end !== null ? Math.max(0, Math.ceil((end - now) / 1000)) : 0
  useEffect(() => {
    if (end !== null && left === 0) { navigator.vibrate?.(400); finish() }
  }, [left, end])

  if (hidden) return null

  return (
    <div className="card cd">
      <div className="cd-head">
        <span className="cd-ic"><Icon name="walk" size={22} /></span>
        <div><small>Opcional</small><h3>{rec.title}</h3></div>
      </div>

      {walked !== null ? (
        <p style={{ margin: '.8rem 0 0' }}>
          {walked >= 30
            ? `Listo, caminaste ${Math.max(1, Math.round(walked / 60))} min. Quedó guardado en tu historial. Hidrátate y descansa.`
            : 'La caminata fue muy corta, así que no se guardó. Cuando quieras, puedes intentarlo de nuevo.'}
        </p>
      ) : end !== null ? (
        <>
          <div className="timer" style={{ fontSize: '3.6rem' }}>{fmt(left)}</div>
          <p className="hint" style={{ textAlign: 'center' }}>Camina a ritmo ligero. Si paras antes, se guarda el tiempo real.</p>
          <button className="btn" onClick={finish}>Terminar caminata</button>
        </>
      ) : (
        <>
          <p className="hint" style={{ margin: '.7rem 0 .2rem' }}>¿Cuántos minutos? Sugerido para ti: {rec.suggested}</p>
          <div>
            {rec.options.map(m => (
              <button key={m} className={`chipbtn${minutes === m ? ' on' : ''}`} onClick={() => setMinutes(m)}>{m} min</button>
            ))}
          </div>

          <h4 className="cd-h">¿Por qué es bueno?</h4>
          <ul className="cd-list">{rec.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
          <h4 className="cd-h">Cómo hacerlo</h4>
          <ul className="cd-list">{rec.tips.map((w, i) => <li key={i}>{w}</li>)}</ul>

          <button className="btn primary" onClick={() => { startedAt.current = Date.now(); setNow(Date.now()); setEnd(Date.now() + minutes * 60000) }}>
            Empezar {minutes} min de {rec.mode === 'caminadora' ? 'caminadora' : 'caminata'}
          </button>
          <button className="link" onClick={() => setHidden(true)}>Hoy no, gracias</button>
        </>
      )}
    </div>
  )
}

function Session({ day, min, setMin, onClose }: {
  day: PlanDay; min: boolean; setMin: (b: boolean) => void; onClose: () => void
}) {
  const { session, profile } = useAuth()
  const list = day.exercises
  const [phase, setPhase] = useState<'warm' | 'work'>('warm')
  const [ex, setEx] = useState(0)
  const [rows, setRows] = useState<Row[][]>(() =>
    list.map(e => Array.from({ length: e.sets }, () => ({ kg: '', reps: String(repsDefault(e.reps)), done: false }))))
  const [restCfg, setRestCfg] = useState<Record<number, number>>({})
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [showNote, setShowNote] = useState(false)
  const [last, setLast] = useState<Record<string, { kg: number; reps: number | null }>>({})
  const [done, setDone] = useState<{ sec: number; sets: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [now, setNow] = useState(Date.now())
  const [confirmExit, setConfirmExit] = useState(false)
  const [skipAsk, setSkipAsk] = useState(false)
  const [wChk, setWChk] = useState<Record<number, boolean>>({})
  const [wEnd, setWEnd] = useState<number | null>(null)

  const warm = useMemo(() => buildWarmup(day, profile?.training_place ?? null), [day, profile?.training_place])
  const cardio = useMemo(() => cardioRec(profile?.training_place ?? null, profile?.goal ?? null), [profile?.training_place, profile?.goal])

  const t0 = useRef(Date.now())
  const lastTick = useRef(Date.now())
  const exSec = useRef<Record<string, number>>({})
  const exRef = useRef(0)
  const phaseRef = useRef<'warm' | 'work'>('warm')
  const logsSaved = useRef(false)
  const warmBeeped = useRef(false)
  exRef.current = ex
  phaseRef.current = phase

   // Fin del cronómetro del calentamiento: empieza el entrenamiento solo
  useEffect(() => {
    if (wEnd !== null && now >= wEnd && !warmBeeped.current) {
      warmBeeped.current = true
      navigator.vibrate?.(400)
      t0.current = Date.now()
      lastTick.current = Date.now()
      setPhase('work')
      window.scrollTo(0, 0)
    }
  }, [now, wEnd])

  // Reloj general: el tiempo por ejercicio solo cuenta durante el entrenamiento (no el calentamiento)
  useEffect(() => {
    if (done) return
    lastTick.current = Date.now()
    const id = setInterval(() => {
      const n = Date.now()
      const name = list[exRef.current]?.name
      if (phaseRef.current === 'work' && name) exSec.current[name] = (exSec.current[name] ?? 0) + (n - lastTick.current) / 1000
      lastTick.current = n
      setNow(n)
    }, 500)
    return () => clearInterval(id)
  }, [done])

  // Fin del descanso
  useEffect(() => {
    if (restEnd !== null && now >= restEnd) { navigator.vibrate?.(300); setRestEnd(null) }
  }, [now, restEnd])

  // Fin del cronómetro del calentamiento
  useEffect(() => {
    if (wEnd !== null && now >= wEnd && !warmBeeped.current) { warmBeeped.current = true; navigator.vibrate?.(400) }
  }, [now, wEnd])

  if (list.length === 0) return null

  const startWork = () => {
    t0.current = Date.now()
    lastTick.current = Date.now()
    setSkipAsk(false)
    setPhase('work')
    window.scrollTo(0, 0)
  }

  const cur = list[ex]
  const curRows = rows[ex]
  const restSecs = restCfg[ex] ?? cur.rest
  const rest = restEnd !== null ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : null
  const elapsed = done ? done.sec : phase === 'work' ? Math.floor((now - t0.current) / 1000) : 0
  const warmLeft = wEnd !== null ? Math.max(0, Math.ceil((wEnd - now) / 1000)) : warm.totalSec
  const allDone = (i: number) => rows[i].length > 0 && rows[i].every(r => r.done)
  const totalSets = rows.reduce((a, r) => a + r.length, 0)
  const doneSets = rows.reduce((a, r) => a + r.filter(x => x.done).length, 0)
  const complete = totalSets > 0 && doneSets === totalSets
  const isLast = ex === list.length - 1
  const pending = list.findIndex((_, i) => !allDone(i))
  const g = groupOf(cur.name)

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, k) => (k === ex ? r.map((x, j) => (j === i ? { ...x, ...patch } : x)) : r)))

  const toggleSet = (i: number) => {
    const row = curRows[i]
    setRow(i, { done: !row.done })
    if (row.done) return
    const finishesAll = rows.every((r, k) => r.every((x, j) => (k === ex && j === i) || x.done))
    if (!finishesAll) setRestEnd(Date.now() + restSecs * 1000)
  }

  const addSet = () => {
    const prev = curRows[curRows.length - 1]
    setRows(rs => rs.map((r, k) => (k === ex ? [...r, { kg: prev?.kg ?? '', reps: prev?.reps ?? '10', done: false }] : r)))
  }

  const goTo = (i: number) => { setEx(i); setShowNote(false); setRestEnd(null) }

  const save = async () => {
    setSaving(true); setErr('')
    const uid = session!.user.id
    const sec = Math.floor((Date.now() - t0.current) / 1000)
    if (!logsSaved.current) {
      const logs = list.flatMap((e, i) => rows[i].filter(r => r.done).map(r => ({
        user_id: uid, exercise: e.name, weight_kg: Number(r.kg) || 0, reps: Number(r.reps) || null,
      })))
      const a = await supabase.from('workout_logs').insert(logs)
      if (a.error) { setErr(a.error.message); setSaving(false); return }
      logsSaved.current = true
    }
    const exs: Record<string, number> = {}
    Object.entries(exSec.current).forEach(([k, v]) => { exs[k] = Math.round(v) })
    const b = await supabase.from('workout_sessions').insert({
      user_id: uid, day_name: day.name, sets_done: doneSets, duration_sec: sec, ex_seconds: exs,
    })
    setSaving(false)
    if (b.error) { setErr(b.error.message); return }
    setDone({ sec, sets: doneSets })
  }

  const finishTop = () => {
    if (complete) { save(); return }
    setConfirmExit(true)
  }

  const partName = day.name.split(' · ')[1] ?? day.name
  const miniLabel = done ? 'Completado'
    : phase === 'warm' ? 'Calentamiento'
    : `Ejercicio ${ex + 1}/${list.length} · ${doneSets}/${totalSets} series`
  const miniTime = phase === 'warm' && !done ? fmt(warmLeft) : fmt(rest ?? elapsed)
  const wDone = warm.steps.filter((_, i) => wChk[i]).length

  return (
    <>
      {min && (
        <div className="wk-mini" role="button" onClick={() => setMin(false)}>
          <span className="mini-circ"><Icon name={phase === 'warm' && !done ? 'flame' : 'dumbbell'} size={20} /></span>
          <div className="mini-info"><b>{partName}</b><small>{miniLabel}</small></div>
          <span className="mini-time">{rest !== null && phase === 'work' ? <small>Desc. </small> : null}{miniTime}</span>
          <Icon name="up" size={22} />
          <i className="wk-prog" style={{ width: `${phase === 'warm' ? (wDone / warm.steps.length) * 100 : (doneSets / Math.max(1, totalSets)) * 100}%` }} />
        </div>
      )}

      <div className="wk-full" style={min ? { display: 'none' } : undefined}>
        {done ? (
          <>
            <div className="card grad" style={{ textAlign: 'center', marginTop: '1.2rem' }}>
              <div className="big-icon"><Icon name="check" size={44} /></div>
              <h2>Entrenamiento completado</h2>
              <p>{done.sets} series en {fmt(done.sec)}. Tu sesión quedó guardada. Descansa, hidrátate y come bien.</p>
            </div>
            <Cooldown rec={cardio} />
            <button className="btn" onClick={onClose}>Cerrar</button>
          </>
        ) : phase === 'warm' ? (
          <>
            <div className="sess-top">
              <button className="icon-btn" onClick={() => setMin(true)} aria-label="Minimizar"><Icon name="down" size={26} /></button>
              <div className="wk-clock"><small>Calentamiento</small><span>{fmt(warmLeft)}</span></div>
              <button className="finish-btn" onClick={onClose}>Salir</button>
            </div>

            <h2 style={{ marginBottom: '.2rem' }}>Calienta antes de entrenar</h2>
            <p className="hint" style={{ margin: 0 }}>Hoy toca: {warm.groups.join(' y ') || partName} · unos {Math.round(warm.totalSec / 60)} min</p>

            <div className="card" style={{ marginTop: '.9rem' }}>
              <h3>¿Por qué calentar?</h3>
              <ul className="cd-list">
                <li>Sube la temperatura de tus músculos y aumenta el flujo de sangre hacia ellos.</li>
                <li>Prepara articulaciones y tendones para moverse en todo su recorrido, con mejor técnica.</li>
                <li>Activa el sistema nervioso, así rindes mejor desde las primeras series.</li>
                <li>Puede ayudar a reducir el riesgo de molestias y tirones, sobre todo con cargas altas.</li>
              </ul>
            </div>

            <div className="card" style={{ padding: '.3rem 1rem' }}>
              {warm.steps.map((s, i) => (
                <button key={i} className={`wstep${wChk[i] ? ' on' : ''}`} onClick={() => setWChk(c => ({ ...c, [i]: !c[i] }))}>
                  <span className="wchk">{wChk[i] ? <Icon name="check" size={16} /> : i + 1}</span>
                  <span className="wtxt"><b>{s.name}</b><small>{s.detail}</small></span>
                  <span className="wsec">{s.sec >= 60 ? `${Math.round(s.sec / 60 * 10) / 10} min` : `${s.sec} s`}</span>
                </button>
              ))}
            </div>

                       {wEnd === null ? (
              <button className="btn primary" onClick={() => { warmBeeped.current = false; setNow(Date.now()); setWEnd(Date.now() + warm.totalSec * 1000) }}>
                <Icon name="clock" size={16} /> Iniciar cronómetro ({Math.round(warm.totalSec / 60)} min)
              </button>
            ) : (
              <div className="okbox">Calentando… el entrenamiento empezará solo cuando el cronómetro llegue a cero.</div>
            )}
            <button className="link" onClick={() => setSkipAsk(true)}>Saltar calentamiento</button>
          </>
        ) : (
          <>
            <div className="sess-top">
              <button className="icon-btn" onClick={() => setMin(true)} aria-label="Minimizar"><Icon name="down" size={26} /></button>
              <div className="wk-clock"><small>Tiempo</small><span>{fmt(elapsed)}</span></div>
              <button className="finish-btn" onClick={finishTop} disabled={saving}>{saving ? 'Guardando…' : 'Terminar'}</button>
            </div>

            <div className="strip">
              {list.map((e, i) => (
                <button key={`${e.name}-${i}`} className={`sthumb${i === ex ? ' on' : ''}${allDone(i) ? ' ok' : ''}`} onClick={() => goTo(i)}>
                  <span className="circ">{allDone(i) ? <Icon name="check" size={22} /> : i + 1}</span>
                  <small>{e.name}</small>
                </button>
              ))}
            </div>

            <BodyMap pcts={g ? { [g]: 100 } : {}} max={100} only={g === 'espalda' ? 'back' : 'front'} compact />

            <h2 className="exname">{cur.name}</h2>
            <p className="howto">{howTo(cur.name)}</p>

            <div className="qrow">
              <button className="qbtn" onClick={() => setShowNote(s => !s)}><Icon name="pencil" size={16} />Notas</button>
              <button className="qbtn" onClick={() => setRestCfg(c => ({ ...c, [ex]: restSecs >= 180 ? 30 : restSecs + 15 }))}>
                <Icon name="clock" size={16} />Descanso {fmt(restSecs)}
              </button>
              <button className="qbtn" onClick={() => goTo((ex + 1) % list.length)}><Icon name="skip" size={16} />Saltar</button>
            </div>

            {showNote && (
              <textarea placeholder="Tus notas para este ejercicio…" value={notes[ex] ?? ''}
                onChange={e => setNotes(n => ({ ...n, [ex]: e.target.value }))} />
            )}

            <div className="stable">
              <div className="shead"><span>Serie</span><span>Previa</span><span>Kg</span><span>Repes</span><span /></div>
              {curRows.map((r, i) => (
                <div className={`srow${r.done ? ' done' : ''}`} key={i}>
                  <span className="sn">{i + 1}</span>
                  <span className="prev">{last[cur.name] ? `${last[cur.name].kg} × ${last[cur.name].reps ?? '–'}` : '–'}</span>
                  <input type="number" inputMode="decimal" placeholder="0" value={r.kg} onChange={e => setRow(i, { kg: e.target.value })} />
                  <input type="number" inputMode="numeric" value={r.reps} onChange={e => setRow(i, { reps: e.target.value })} />
                  <button className="chk" onClick={() => toggleSet(i)} aria-label={`Serie ${i + 1} hecha`}><Icon name="check" size={18} /></button>
                </div>
              ))}
            </div>

            <button className="btn add" onClick={addSet}><Icon name="plus" size={16} /> Añadir serie</button>

            {complete ? (
              <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Terminar entrenamiento'}</button>
            ) : allDone(ex) ? (
              isLast
                ? <button className="btn primary" onClick={() => goTo(pending)}>Ir a un ejercicio pendiente</button>
                : <button className="btn primary" onClick={() => goTo(ex + 1)}>Siguiente: {list[ex + 1].name}</button>
            ) : null}

            {!complete && <p className="hint" style={{ textAlign: 'center' }}>Para que cuente, completa todas las series ({doneSets}/{totalSets}).</p>}
            {err && <p className="error">{err}</p>}

            {rest !== null && (
              <div className="restbar">
                <div><small>Descanso</small><b>{fmt(rest)}</b></div>
                <button onClick={() => setRestEnd(e => (e ?? Date.now()) - 15000)}>−15</button>
                <button onClick={() => setRestEnd(e => (e ?? Date.now()) + 15000)}>+15</button>
                <button className="skipbtn" onClick={() => setRestEnd(null)}>Omitir</button>
              </div>
            )}
          </>
        )}
      </div>

      {skipAsk && (
        <div className="dlg-bg" onClick={() => setSkipAsk(false)}>
          <div className="dlg" role="alertdialog" aria-label="Saltar calentamiento" onClick={e => e.stopPropagation()}>
            <div className="dlg-ic"><Icon name="flame" size={28} /></div>
            <h3>¿Saltar el calentamiento?</h3>
            <p>Puedes hacerlo, pero entrenar en frío tiene desventajas:</p>
            <ul className="cd-list" style={{ textAlign: 'left', margin: '0 0 1rem' }}>
              <li>Músculos y articulaciones menos preparados, con más rigidez.</li>
              <li>Menor rendimiento en las primeras series.</li>
              <li>Puede aumentar el riesgo de molestias o tirones, sobre todo con cargas altas.</li>
            </ul>
            <p style={{ marginBottom: '.4rem' }}>Si decides saltarlo, haz al menos 1 o 2 series muy ligeras de tu primer ejercicio.</p>
            <button className="btn primary" onClick={() => setSkipAsk(false)}>Hacer el calentamiento</button>
            <button className="btn dlg-out" onClick={startWork}>Saltar de todos modos</button>
          </div>
        </div>
      )}

      {confirmExit && (
        <div className="dlg-bg" onClick={() => setConfirmExit(false)}>
          <div className="dlg" role="alertdialog" aria-label="Rutina incompleta" onClick={e => e.stopPropagation()}>
            <div className="dlg-ic"><Icon name="alert" size={28} /></div>
            <h3>Rutina incompleta</h3>
            <p>Si sales ahora, este entrenamiento <b>no se contará</b> ni se guardará en tu historial ni en tu racha.</p>
            <div className="dlg-prog">
              <div className="dlg-prog-top"><span>Tu avance</span><b>{doneSets}/{totalSets} series</b></div>
              <div className="hbar"><i style={{ width: `${(doneSets / Math.max(1, totalSets)) * 100}%` }} /></div>
            </div>
            <button className="btn primary" onClick={() => setConfirmExit(false)}>Seguir entrenando</button>
            <button className="btn dlg-out" onClick={() => { setConfirmExit(false); onClose() }}>Salir y descartar</button>
          </div>
        </div>
      )}
    </>
  )
}