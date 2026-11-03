import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { type Answers } from '../lib/questionnaires'
import { groupOf, planProgress, regenerateRoutine, type Plan, type PlanDay } from '../lib/routine'
import Icon from '../components/Icons'
import { Library, AiBuilder } from './Library'
import { BodyMap } from '../components/Body'
import { useWorkout } from '../components/Workout'
import Nutrition from './Nutrition'
import Supplements from './Supplements'
import Prevention, { InjuryBanner, InjuryBlock } from './Prevention'
import { useInjury } from '../lib/injury'

const META: Record<string, { db: string; title: string; cta: string }> = {
  ejercicios: { db: 'rutinas', title: 'Tu plan', cta: 'Completa tu perfil de rutinas' },
  nutricion: { db: 'nutricion', title: 'Nutrición', cta: 'Completa tu perfil nutricional' },
  lesiones: { db: 'lesiones', title: 'Prevención de lesiones', cta: 'Completa tu perfil de prevención' },
  suplementos: { db: 'suplementos', title: 'Suplementos', cta: 'Completa tu perfil de suplementos' },
}



/* ---------------- EJERCICIOS ---------------- */
const MUSCLE: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros',
  brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}

/** Porcentaje de series por grupo muscular */
function distribution(day: PlanDay) {
  const sets: Record<string, number> = {}
  let total = 0
  day.exercises.forEach(e => {
    const g = groupOf(e.name)
    if (!g) return
    sets[g] = (sets[g] ?? 0) + e.sets
    total += e.sets
  })
  const pcts: Record<string, number> = {}
  Object.keys(sets).forEach(g => { pcts[g] = Math.round((sets[g] / total) * 100) })
  const list = Object.entries(pcts).sort((a, b) => b[1] - a[1])
  return { pcts, list, max: Math.max(1, ...Object.values(pcts)) }
}




/* ---------- Pantalla de rutinas ---------- */
function Exercises({ plan }: { plan: Plan | null }) {
  const loc = useLocation()
  const [view, setView] = useState<number | null>((loc.state as { day?: number } | null)?.day ?? null)
  const [screen, setScreen] = useState<'plan' | 'library' | 'ai'>('plan')
  const { session, profile } = useAuth()
  const { start } = useWorkout()
  const inj = useInjury()
  if (inj.summary.mode === 'blocked') return <InjuryBlock s={inj.summary} />

  const go = (v: number | null) => { setView(v); window.scrollTo(0, 0) }

  const backToAuto = async () => {
    if (!window.confirm('Tu plan semanal volverá a ser el automático según tu perfil. Tus rutinas de la biblioteca no se borran. ¿Continuar?')) return
    await regenerateRoutine(session!.user.id, profile, true)
    window.location.reload()
  }

  if (!plan) return <p className="hint">Aún no se pudo generar tu rutina.</p>
  if (plan.days.length === 0) return <>{plan.warnings.map((w, i) => <div key={i} className="urgent">{w}</div>)}
        <InjuryBanner s={inj.summary} />
  </>

  

  if (screen === 'library') return <Library onBack={() => setScreen('plan')} onStart={d => start(d)} />
  if (screen === 'ai') return <AiBuilder onBack={() => setScreen('plan')} onSaved={() => setScreen('library')} onAdopted={() => window.location.reload()} />

  const pr = planProgress(plan)
  const partName = (d: PlanDay) => d.name.split(' · ')[1] ?? d.name

  /* ---- Detalle de un día ---- */
  if (view !== null) {
    const day = pr.days[view]
    const { pcts, list, max } = distribution(day)
    return (
      <>
        <button className="back" onClick={() => go(null)}>← Tu plan</button>
        <p className="hint" style={{ margin: 0 }}>{day.weekday}{view === pr.todayIdx && ' · hoy'}</p>
        <h2>{partName(day)}</h2>

        <h3>Distribución muscular</h3>
        <BodyMap pcts={pcts} max={max} />
        <div className="mtiles">
          {list.map(([g, p]) => (
            <div className="mtile" key={g}>
              <b>{p}%</b><small>{MUSCLE[g]}</small>
              <span className="bar"><i style={{ width: `${p}%` }} /></span>
            </div>
          ))}
        </div>

        <h3 style={{ marginTop: '1.4rem' }}>Ejercicios</h3>
        <div className="hscroll">
          {day.exercises.map((e, i) => (
            <div className="hcard" key={`${e.name}-${i}`}>
              <span className="n">{i + 1}</span>
              <b>{e.name}</b>
              <small>{e.sets} series × {e.reps}</small>
              <small>Descanso {e.rest} s</small>
              <span className="tag">{MUSCLE[groupOf(e.name) ?? ''] ?? ''}</span>
            </div>
          ))}
        </div>

        <button className="btn primary" onClick={() => start(day)}>Empezar ejercicio</button>
      </>
    )
  }

  /* ---- Lista de tarjetas (primero el día que toca) ---- */
  const order: number[] = []
  for (let k = 0; k < 7; k++) {
    const i = (pr.todayIdx + k) % 7
    if (!pr.days[i].rest) order.push(i)
  }
  const todayRest = pr.days[pr.todayIdx].rest

  return (
    <>
      {plan.warnings.map((w, i) => <div key={i} className="warn">{w}</div>)}

      <div className="card grad">
        <b>Semana {pr.weekNumber} de {pr.total}</b>{pr.cycle > 1 && <> · Ciclo {pr.cycle}</>}
        <p style={{ margin: '.3rem 0 0', fontSize: '.88rem' }}>
          {plan.custom
            ? `Usas una rutina propuesta por la IA. Sigue esta rutina hasta el ${pr.end.toLocaleDateString('es', { day: 'numeric', month: 'long' })}. Tus ejercicios no cambian solos.`
            : `Sigue esta rutina hasta el ${pr.end.toLocaleDateString('es', { day: 'numeric', month: 'long' })}. Los ejercicios cambian en la semana 3 y después comienza un nuevo ciclo.`}
        </p>
        {plan.custom && <button className="btn" onClick={backToAuto}>Volver al plan automático</button>}
      </div>

      {todayRest && <p className="hint">Hoy es día de descanso. Tu próximo entrenamiento va primero.</p>}

            <div className="hscroll">
        {order.map((i, k) => {
          const d = pr.days[i]
          const top = distribution(d).list.slice(0, 3).map(([g]) => MUSCLE[g])
          return (
            <div className={`rcard${k === 0 ? ' first' : ''}`} key={d.weekday}>
              <small className="wk">{d.weekday}{i === pr.todayIdx && <span className="badge">Hoy</span>}</small>
              <h3>{partName(d)}</h3>
              <p className="hint">{d.exercises.length} ejercicios</p>
              <div className="rtags">{top.map(m => <span className="tag" key={m}>{m}</span>)}</div>
              <button className="btn-ver" onClick={() => go(i)}>Ver</button>
            </div>
          )
        })}
      </div>

      <h3 style={{ marginTop: '1.4rem' }}>Más opciones</h3>
      <div className="opts">
        <button className="opt" onClick={() => setScreen('library')}>
          <span className="ic"><Icon name="list" /></span><b>Biblioteca</b><small>Tus rutinas e historial</small>
        </button>
        <button className="opt" onClick={() => setScreen('ai')}>
          <span className="ic"><Icon name="spark" /></span><b>Crear rutina con IA</b><small>División según tu perfil</small>
        </button>
      </div>

      {plan.notes.length > 0 && (
        <div className="card">
          <h3>Notas</h3>
          {plan.notes.map((n, i) => <p key={i} className="hint">• {n}</p>)}
        </div>
      )}
    </>
  )
}

/* ---------------- NUTRICIÓN ---------------- */

/* ---------------- LESIONES ---------------- */


/* ---------------- PÁGINA ---------------- */
export default function Module() {
  const { module = '' } = useParams()
  const { session, profile } = useAuth()
  const meta = META[module]
  const [answers, setAnswers] = useState<Answers | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!meta) return
    setLoading(true)
    ;(async () => {
      const { data } = await supabase.from('module_profiles').select('answers').eq('module', meta.db).maybeSingle()
      setAnswers(data?.answers ?? null)
      if (module === 'ejercicios') {
        let r = await supabase.from('routines').select('plan').maybeSingle()
        // si el plan es de la versión anterior (sin semanas), se regenera con las respuestas guardadas
        if (data?.answers && (!r.data?.plan || (!r.data.plan.weeks && r.data.plan.days.length > 0))) {
          await regenerateRoutine(session!.user.id, profile)
          r = await supabase.from('routines').select('plan').maybeSingle()
        }
        setPlan(r.data?.plan ?? null)
      }
      setLoading(false)
    })()
  }, [module])

  if (!meta) return <p>Módulo no encontrado</p>
  if (loading) return <p className="center">Cargando...</p>

  return (
    <>
      <h1>{meta.title}</h1>
            {module === 'lesiones' ? (
        <Prevention a={answers ?? {}} />
      ) : !answers ? (
        <Link to={`/app/${module}/perfil`} className="cta">
          {meta.cta} para personalizar tus recomendaciones
          <small>Toma unos minutos · Tus respuestas son privadas</small>
        </Link>
      ) : (
        <>
          {module === 'ejercicios' && <Exercises plan={plan} />}
          {module === 'nutricion' && <Nutrition a={answers} />}
          {module === 'suplementos' && <Supplements a={answers} />}
          {module !== 'ejercicios' && module !== 'nutricion' && <Link to={`/app/${module}/perfil`} className="btn">Editar mis respuestas</Link>}
        </>
      )}
    </>
  )
}