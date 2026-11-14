import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { groupOf, type PlanDay } from '../lib/routine'
import { howTo } from '../lib/exerciseInfo'
import { buildWarmup, cardioRec, type CardioRec } from '../lib/warmup'
import { BodyMap } from './Body'
import Icon from './Icons'
import { Link, useNavigate } from 'react-router-dom'
import { PainSlider } from '../pages/InjuryCheck'
import { loadsZone, painAdvice, suggestKg, useInjury, ZONE_LABEL } from '../lib/injury'
import { safeInsert } from '../lib/offline'
import { loadNotes, saveNote } from '../lib/notes'

interface Ctx { day: PlanDay | null; min: boolean; start: (d: PlanDay) => void }
const WorkoutCtx = createContext<Ctx>({ day: null, min: false, start: () => {} })
export const useWorkout = () => useContext(WorkoutCtx)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const inj = useInjury()
  const [blockedMsg, setBlockedMsg] = useState(false)
  const [day, setDay] = useState<PlanDay | null>(null)
  const [min, setMin] = useState(false)
  const [run, setRun] = useState(0)

  const start = (d: PlanDay) => {
    if (inj.summary.mode === 'blocked') { setBlockedMsg(true); return }
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
              {blockedMsg && (
        <div className="dlg-bg" onClick={() => setBlockedMsg(false)}>
          <div className="dlg" role="alertdialog" onClick={e => e.stopPropagation()}>
            <div className="dlg-ic"><Icon name="shield" size={28} /></div>
            <h3>Rutinas bloqueadas</h3>
            <p>Por tu molestia, tus rutinas están bloqueadas. Revisa tu estado en Prevención.</p>
            <Link to="/app/lesiones" className="btn primary" onClick={() => setBlockedMsg(false)}>Ir a Prevención</Link>
            <button className="link" onClick={() => setBlockedMsg(false)}>Cerrar</button>
          </div>
        </div>
      )}
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
            await safeInsert('walk_logs', { user_id: session!.user.id, duration_sec: sec, mode: rec.mode, created_at: new Date().toISOString() })
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

  const [showNote, setShowNote] = useState(false)
  const [last] = useState<Record<string, { kg: number; reps: number | null }>>({})
  const [done, setDone] = useState<{ sec: number; sets: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [now, setNow] = useState(Date.now())
  const [confirmExit, setConfirmExit] = useState(false)
  const [skipAsk, setSkipAsk] = useState(false)
  const [] = useState<Record<number, boolean>>({})
  const [wEnd, setWEnd] = useState<number | null>(null)
  const [wStart, setWStart] = useState<number | null>(null)
  const [wShift, setWShift] = useState(0)   // ms adelantados o atrasados al cambiar de paso
  const inj = useInjury()
  const nav = useNavigate()
  const [painDlg, setPainDlg] = useState(false)
  const [painVal, setPainVal] = useState(3)
  
  
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteMsg, setNoteMsg] = useState('')
  const noteTimer = useRef<number | undefined>(undefined)
  
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

     // Fin del calentamiento: empieza el entrenamiento solo
  useEffect(() => {
    if (wStart !== null && wElapsed >= warm.totalSec && !warmBeeped.current) {
      warmBeeped.current = true
      navigator.vibrate?.(400)
      t0.current = Date.now()
      lastTick.current = Date.now()
      setPhase('work')
      window.scrollTo(0, 0)
    }
  }, [now, wStart, wShift])

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

  const lastStep = useRef(-1)
  useEffect(() => {
    if (wStart === null) return
    const el = Math.max(0, now - wStart + wShift) / 1000
    let acc = 0, idx = warm.steps.length - 1
    for (let i = 0; i < warm.steps.length; i++) { acc += warm.steps[i].sec; if (el < acc) { idx = i; break } }
    if (idx !== lastStep.current) { if (lastStep.current !== -1) navigator.vibrate?.(150); lastStep.current = idx }
  }, [now, wStart, wShift])

    // Notas guardadas de estos ejercicios
  useEffect(() => {
    loadNotes(session!.user.id, list.map(e => e.name)).then(n => {
      setNotes(n)
      const first = list[0]?.name
      if (first && n[first]) setShowNote(true)
    })
  }, [])

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
  const loads = inj.summary.mode !== 'free' && loadsZone(cur.name, inj.summary.zones)
  const bonus = loads ? inj.summary.restBonus : 0
  const restSecs = restCfg[ex] ?? (cur.rest + bonus)
  const rest = restEnd !== null ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : null
  const elapsed = done ? done.sec : phase === 'work' ? Math.floor((now - t0.current) / 1000) : 0
  const warmLeft = wStart !== null ? Math.max(0, Math.ceil(warm.totalSec - Math.max(0, now - wStart + wShift) / 1000)) : warm.totalSec
    // Tiempo transcurrido del calentamiento y paso en el que va
  const wElapsed = wStart !== null ? Math.max(0, now - wStart + wShift) / 1000 : 0
  const cum: number[] = []
  warm.steps.reduce((a, s) => { cum.push(a + s.sec); return a + s.sec }, 0)
  const wIdx = wStart === null ? -1 : Math.min(cum.findIndex(c => wElapsed < c) === -1 ? warm.steps.length - 1 : cum.findIndex(c => wElapsed < c), warm.steps.length - 1)
  const stepStart = wIdx > 0 ? cum[wIdx - 1] : 0
  const stepLeft = wIdx >= 0 ? Math.max(0, Math.ceil(cum[wIdx] - wElapsed)) : 0
  const wPct = wStart === null ? 0 : Math.min(100, (wElapsed / warm.totalSec) * 100)

  // Salta al inicio del paso indicado
  const jump = (to: number) => {
    if (wStart === null) return
    const target = to <= 0 ? 0 : cum[to - 1]
    setWShift(target * 1000 - (Date.now() - wStart) + 50)
    setNow(Date.now())
  }

    const onNote = (v: string) => {
    const name = cur.name
    setNotes(n => ({ ...n, [name]: v }))
    setNoteMsg('Guardando…')
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(async () => {
      const ok = await saveNote(session!.user.id, name, v)
      setNoteMsg(ok ? 'Guardada' : 'Guardada en tu dispositivo; se enviará cuando haya internet')
    }, 800)
  }


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

    const goTo = (i: number) => {
    setEx(i); setShowNote(!!notes[list[i]?.name]); setNoteMsg(''); setRestEnd(null)
  }

  const save = async () => {
    setSaving(true); setErr('')
    const uid = session!.user.id
    const sec = Math.floor((Date.now() - t0.current) / 1000)
        const stamp = new Date().toISOString()
    if (!logsSaved.current) {
      const logs = list.flatMap((e, i) => rows[i].filter(r => r.done).map(r => ({
        user_id: uid, exercise: e.name, weight_kg: Number(r.kg) || 0, reps: Number(r.reps) || null, logged_at: stamp,
      })))
      const a = await safeInsert('workout_logs', logs)
      if (a.error) { setErr(a.error); setSaving(false); return }
      logsSaved.current = true
    }
    const exs: Record<string, number> = {}
    Object.entries(exSec.current).forEach(([k, v]) => { exs[k] = Math.round(v) })
    const b = await safeInsert('workout_sessions', {
      user_id: uid, day_name: day.name, sets_done: doneSets, duration_sec: sec, ex_seconds: exs, completed_at: stamp,
    })
    setSaving(false)
    if (b.error) { setErr(b.error); return }
    setDone({ sec, sets: doneSets })
  }

  const finishTop = () => {
    if (complete) { save(); return }
    setConfirmExit(true)
  }

  const partName = day.name.split(' · ')[1] ?? day.name
  const miniLabel = done ? 'Completado'
        : phase === 'warm' ? (wStart === null ? 'Calentamiento' : `Calentando · paso ${wIdx + 1}/${warm.steps.length}`)
    : `Ejercicio ${ex + 1}/${list.length} · ${doneSets}/${totalSets} series`
  const miniTime = phase === 'warm' && !done ? fmt(warmLeft) : fmt(rest ?? elapsed)
  const wDone = wStart === null ? 0 : Math.min(warm.steps.length, wIdx + 1)

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

                        {wStart !== null && (
              <div className="card wnow">
                <small>Paso {wIdx + 1} de {warm.steps.length}</small>
                <h3>{warm.steps[wIdx].name}</h3>
                <div className="wtimer">{fmt(stepLeft)}</div>
                <p className="hint" style={{ margin: 0 }}>{warm.steps[wIdx].detail}</p>
                <div className="hbar" style={{ marginTop: '.7rem' }}><i style={{ width: `${((wElapsed - stepStart) / warm.steps[wIdx].sec) * 100}%` }} /></div>
                {warm.steps[wIdx + 1] && <p className="hint" style={{ margin: '.6rem 0 0' }}>Sigue: <b>{warm.steps[wIdx + 1].name}</b></p>}
                <div className="row">
                  <button className="btn" disabled={wIdx === 0 && wElapsed - stepStart < 3} onClick={() => jump(wElapsed - stepStart > 3 ? wIdx : wIdx - 1)}>← Anterior</button>
                  <button className="btn" onClick={() => (wIdx >= warm.steps.length - 1 ? startWork() : jump(wIdx + 1))}>{wIdx >= warm.steps.length - 1 ? 'Terminar' : 'Siguiente →'}</button>
                </div>
              </div>
            )}

            <div className="hbar" style={{ margin: '.8rem 0 .2rem' }}><i style={{ width: `${wPct}%` }} /></div>
            <p className="hint" style={{ margin: '0 0 .4rem' }}>{wStart === null ? 'Toca "Iniciar cronómetro" para empezar.' : `Calentamiento: ${Math.round(wPct)}% · quedan ${fmt(warmLeft)}`}</p>

            <div className="card" style={{ padding: '.3rem 1rem' }}>
              {warm.steps.map((s, i) => {
                const st = wStart === null ? 'idle' : i < wIdx ? 'done' : i === wIdx ? 'now' : 'next'
                return (
                  <div key={i} className={`wstep ${st}`}>
                    <span className="wchk">{st === 'done' ? <Icon name="check" size={16} /> : i + 1}</span>
                    <span className="wtxt"><b>{s.name}</b><small>{s.detail}</small></span>
                    <span className="wsec">{s.sec >= 60 ? `${Math.round(s.sec / 60 * 10) / 10} min` : `${s.sec} s`}</span>
                  </div>
                )
              })}
            </div>

            {wStart === null ? (
              <button className="btn primary" onClick={() => {
                warmBeeped.current = false; lastStep.current = -1
                const t = Date.now(); setNow(t); setWShift(0); setWStart(t); setWEnd(t + warm.totalSec * 1000)
              }}>
                <Icon name="clock" size={16} /> Iniciar cronómetro ({Math.round(warm.totalSec / 60)} min)
              </button>
            ) : (
              <div className="okbox">Calentando… el entrenamiento empezará solo al terminar el último paso.</div>
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

                        {loads && (
              <div className="warn">
                <b>Cuidado con tu {inj.summary.zones.map(z => (ZONE_LABEL[z] ?? z).toLowerCase()).join(', ')}.</b> Este ejercicio la carga: usa cerca del {Math.round(inj.summary.loadFactor * 100)}% de tu carga habitual
                {last[cur.name] ? ` (unos ${suggestKg(last[cur.name].kg, inj.summary.loadFactor)} kg en lugar de ${last[cur.name].kg} kg)` : ''}.
                {' '}Descansa {bonus} s más entre series{inj.summary.setsLess > 0 ? ', haz una serie menos si te molesta' : ''} y para si el dolor pasa de {inj.summary.painStop}/10.
              </div>
            )}

            <h2 className="exname">{cur.name}</h2>
            <p className="howto">{howTo(cur.name)}</p>

            <div className="qrow">
                            <button className="qbtn" onClick={() => setShowNote(s => !s)}>
                <Icon name="pencil" size={16} />Notas{notes[cur.name] ? ' •' : ''}
              </button>
              <button className="qbtn" onClick={() => setRestCfg(c => ({ ...c, [ex]: restSecs >= 180 ? 30 : restSecs + 15 }))}>
                <Icon name="clock" size={16} />Descanso {fmt(restSecs)}
              </button>
              <button className="qbtn" onClick={() => goTo((ex + 1) % list.length)}><Icon name="skip" size={16} />Saltar</button>

                            <button className="qbtn" onClick={() => { setPainVal(3); setPainDlg(true) }}><Icon name="alert" size={16} />Me duele</button>
            </div>
            

            {showNote && (
              <>
                <textarea placeholder="Tus notas para este ejercicio (ajuste de asiento, cómo te sentiste, qué mejorar…)"
                  value={notes[cur.name] ?? ''} onChange={e => onNote(e.target.value)} />
                {noteMsg && <p className="hint" style={{ margin: '0 0 .4rem' }}>{noteMsg}</p>}
              </>
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
            {painDlg && (
        <div className="dlg-bg" onClick={() => setPainDlg(false)}>
          <div className="dlg" role="dialog" onClick={e => e.stopPropagation()}>
            <div className="dlg-ic"><Icon name="alert" size={28} /></div>
            <h3>¿Cuánto te duele?</h3>
            <PainSlider value={painVal} onChange={setPainVal} />
            <p style={{ marginTop: '.8rem' }}>{painAdvice(painVal)}</p>
            {painVal < 7 && <button className="btn primary" onClick={() => setPainDlg(false)}>Seguir con cuidado</button>}
            {painVal >= 4 && <button className="btn" onClick={() => { setPainDlg(false); goTo((ex + 1) % list.length) }}>Saltar este ejercicio</button>}
            {painVal >= 6 && <button className="btn dlg-out" onClick={() => { setPainDlg(false); onClose(); nav('/app/lesiones') }}>Terminar y evaluar mi molestia</button>}
          </div>
        </div>
      )}
    </>
  )
}
