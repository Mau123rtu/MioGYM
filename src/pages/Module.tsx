import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcAge } from '../lib/utils'
import { toArr, type Answers } from '../lib/questionnaires'
import { groupOf, planProgress, regenerateRoutine, type Plan, type PlanDay } from '../lib/routine'
import Icon from '../components/Icons'
import { Library, AiBuilder } from './Library'
import { BodyMap } from '../components/Body'
import { useWorkout } from '../components/Workout'

const META: Record<string, { db: string; title: string; cta: string }> = {
  ejercicios: { db: 'rutinas', title: 'Tu plan', cta: 'Completa tu perfil de rutinas' },
  nutricion: { db: 'nutricion', title: 'Nutrición', cta: 'Completa tu perfil nutricional' },
  lesiones: { db: 'lesiones', title: 'Prevención de lesiones', cta: 'Completa tu perfil de prevención' },
  suplementos: { db: 'suplementos', title: 'Suplementos', cta: 'Completa tu perfil de suplementos' },
}

const URGENT = 'Si sientes dolor en el pecho, desmayo o dificultad importante para respirar, detén el ejercicio y busca atención médica urgente.'

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

  const go = (v: number | null) => { setView(v); window.scrollTo(0, 0) }

  const backToAuto = async () => {
    if (!window.confirm('Tu plan semanal volverá a ser el automático según tu perfil. Tus rutinas de la biblioteca no se borran. ¿Continuar?')) return
    await regenerateRoutine(session!.user.id, profile, true)
    window.location.reload()
  }

  if (!plan) return <p className="hint">Aún no se pudo generar tu rutina.</p>
  if (plan.days.length === 0) return <>{plan.warnings.map((w, i) => <div key={i} className="urgent">{w}</div>)}</>

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
function Nutrition({ a }: { a: Answers }) {
  const { profile } = useAuth()
  const age = calcAge(profile?.birth_date ?? null)
  const meals: Record<string, string> = {
    '1-2': 'Con pocas comidas, haz que cada una sea completa: proteína, carbohidrato, verduras y una grasa saludable.',
    '3': 'Desayuno, comida y cena, cada una con una porción de proteína y verduras.',
    '4': 'Tres comidas principales y una colación con proteína (yogur, huevo, fruta con nueces).',
    '5+': 'Reparte la comida en porciones moderadas y procura proteína en la mayoría de ellas.',
    variable: 'Como tu horario cambia, define 2 o 3 comidas "ancla" que sí puedas cuidar cada día.',
  }
  const goal: Record<string, string> = {
    masa: 'Para ganar masa muscular importa comer lo suficiente y mantener proteína constante.',
    grasa: 'Para perder grasa, prioriza alimentos saciantes (proteína, fibra) y avanza gradualmente.',
    mantener: 'Para mantener tu peso, busca regularidad y variedad.',
    habitos: 'Para mejorar hábitos, cambia una cosa a la vez y hazla sostenible.',
    rendimiento: 'Para rendir mejor, cuida la comida previa y posterior a entrenar.',
  }
  const time: Record<string, string> = {
    '<15': 'Opciones rápidas: omelette con verduras, bowl de atún, yogur con avena y fruta.',
    '15-30': 'Salteados, tacos de pollo o pescado a la plancha con ensalada, pasta integral con legumbres.',
    '>30': 'Tienes margen para guisos, hornear verduras y cocinar legumbres.',
    lotes: 'Cocina por lotes: arroz, legumbres y proteína para 3–4 días, y guárdalo en porciones.',
    fuera: 'Fuera de casa, elige platos a la plancha o al horno, con verdura, y pide aderezos aparte.',
  }
  return (
    <>
      {age !== null && age < 18 && <div className="warn">Eres menor de edad: no aplicamos objetivos restrictivos de calorías. Consulta con un profesional de salud o nutrición.</div>}
      {a.condicion === 'si' && <div className="warn">Indicaste una condición o indicación profesional. Sigue siempre esa indicación; estas sugerencias son generales.</div>}
      {a.alergias === 'si' && <div className="urgent"><b>{a.alergias_tipo === 'alergia' ? 'Alergia' : a.alergias_tipo === 'intolerancia' ? 'Intolerancia' : 'Preferencia'}:</b> {a.alergias_detalle || 'sin detalle'}. {a.alergias_tipo === 'alergia' && 'Revisa siempre las etiquetas.'}</div>}
      <div className="card"><h3>Tu enfoque</h3><p>{goal[a.objetivo]}</p></div>
      <div className="card"><h3>Distribución de comidas</h3><p>{meals[a.comidas]}</p></div>
      <div className="card"><h3>Preparación</h3><p>{time[a.tiempo]}</p></div>
      <div className="card"><h3>Hidratación</h3>
        <p>Tu estimación actual: {({ '<1': 'menos de 1 L', '1-2': '1 a 2 L', '2-3': '2 a 3 L', '>3': 'más de 3 L', nose: 'no lo sabes' } as Record<string, string>)[a.agua]}. Bebe a lo largo del día y activa el recordatorio de agua en Más → Cuenta.</p></div>
      {a.presupuesto === 'cantidad' && <div className="card"><h3>Presupuesto</h3><p>{a.pres_monto} {a.pres_moneda} ({a.pres_periodo}) para {a.pres_personas || 1} persona(s). Legumbres, huevo, avena, arroz y verdura de temporada rinden mucho.</p></div>}
      <p className="hint">No calculamos calorías ni macros automáticamente: eso requiere más datos (actividad, entrenamiento) y valoración profesional.</p>
    </>
  )
}

/* ---------------- LESIONES ---------------- */
function Injuries({ a }: { a: Answers }) {
  const zones = toArr(a.zonas)
  const want = (k: string) => toArr(a.mejorar).some(x => x === k || x === 'todo')
  return (
    <>
      {a.alarma === 'si' && <div className="urgent"><b>Importante:</b> {URGENT} No entrenes hasta que un profesional te valore.</div>}
      {a.dolor === 'si' && (
        <div className="warn">
          Zonas con molestia: {zones.map(z => <span className="tag" key={z}>{z}</span>)}
          <p>Tu rutina evita ejercicios que carguen esas zonas. {(a.intensidad === 'intenso' || toArr(a.situaciones).includes('reposo')) && 'Como el dolor es intenso o aparece en reposo, te recomendamos una valoración profesional.'}</p>
        </div>
      )}
      <div className="card"><h3>Calentamiento general (5–8 min)</h3>
        <p className="hint">1) 3–5 min de cardio ligero · 2) círculos de hombros, cadera y tobillos · 3) sentadilla sin peso × 10 · 4) 1–2 series ligeras del primer ejercicio.</p>
        {(a.calentamiento === 'directo' || a.calentamiento === 'ninguno') && <p>Notamos que empiezas sin calentar: probar esto antes de entrenar reduce riesgos evitables.</p>}</div>
      {want('tecnica') && <div className="card"><h3>Técnica</h3><p className="hint">Controla la bajada, mantén la espalda neutra, no rebotes y detén la serie cuando la técnica se rompa.</p></div>}
      {want('movilidad') && <div className="card"><h3>Movilidad</h3><p className="hint">Dedica 5 min a cadera, hombros y tobillos tras entrenar o en días de descanso.</p></div>}
      {want('cargas') && <div className="card"><h3>Progresión gradual</h3><p className="hint">Sube el peso o las repeticiones solo cuando completes todas las series con buena técnica, y no más de un pequeño ajuste por semana.</p></div>}
      {want('errores') && <div className="card"><h3>Errores frecuentes</h3><p className="hint">Saltarse el calentamiento, usar demasiado peso, entrenar con dolor agudo y no descansar.</p></div>}
      <div className="urgent">{URGENT}</div>
      <p className="hint">Esta sección no diagnostica lesiones. Ante dolor persistente, consulta a un profesional sanitario.</p>
    </>
  )
}

/* ---------------- SUPLEMENTOS ---------------- */
const SUPS = [
  { n: 'Creatina monohidratada', ev: 'Es de los suplementos con mejor evidencia para fuerza y masa muscular.', dose: 'Se ha estudiado 3–5 g al día.', risk: 'Puede retener algo de agua. Consulta con tu médico si tienes enfermedad renal.' },
  { n: 'Proteína en polvo', ev: 'Es una forma práctica de completar la proteína total del día; no es obligatoria.', dose: 'Importa la ingesta diaria total, no una toma concreta.', risk: 'Revisa la etiqueta: edulcorantes, lactosa y alérgenos.' },
  { n: 'Cafeína', ev: 'Puede mejorar el rendimiento y la sensación de energía.', dose: 'Hasta unos 400 mg al día se considera límite habitual en adultos sanos.', risk: 'Evítala o consulta si tienes ansiedad, hipertensión, problemas de sueño o embarazo.' },
  { n: 'Vitaminas y minerales', ev: 'Útiles si hay una deficiencia confirmada o una dieta restrictiva.', dose: 'Depende de análisis y valoración profesional.', risk: 'Tomar de más puede ser perjudicial.' },
]
function Supplements({ a }: { a: Answers }) {
  const { profile } = useAuth()
  const age = calcAge(profile?.birth_date ?? null)
  const info = toArr(a.info)
  const showDose = info.includes('dosis')
  return (
    <>
      {age !== null && age < 18 && <div className="warn">Al ser menor de edad, consulta con un médico antes de usar cualquier suplemento.</div>}
      {(a.medicacion === 'si') && <div className="warn">Indicaste medicamentos o una indicación médica. Antes de usar cualquier suplemento, consulta a tu médico o farmacéutico por posibles interacciones.</div>}
      {toArr(a.actuales).filter(x => x !== 'ninguno').length > 0 && <div className="card"><h3>Lo que usas hoy</h3>{toArr(a.actuales).map(x => <span className="tag" key={x}>{x}</span>)}{a.detalle && <p className="hint">{a.detalle}</p>}</div>}
      <div className="card"><h3>Primero lo básico</h3><p className="hint">Una buena alimentación, entrenamiento y sueño pesan mucho más que cualquier suplemento. No necesitas consumirlos para lograr tu objetivo.</p></div>
      {SUPS.map(s => (
        <div className="card" key={s.n}>
          <h3>{s.n}</h3>
          <p>{s.ev}</p>
          {showDose && <p className="hint"><b>Dosis estudiadas:</b> {s.dose}</p>}
          <p className="hint"><b>Precauciones:</b> {s.risk}</p>
        </div>
      ))}
      {info.includes('etiquetas') && <div className="card"><h3>Cómo leer una etiqueta</h3><p className="hint">Revisa la cantidad real del ingrediente activo por toma, los alérgenos y si evita "mezclas propietarias". Un sello de certificación independiente ayuda, pero no garantiza que sea adecuado para ti.</p></div>}
      {a.pres_monto && <p className="hint">Tu presupuesto: {a.pres_monto}. Úsalo para comparar precio por porción, no para decidir qué necesitas.</p>}
      <p className="hint">Información educativa; no sustituye la orientación de un médico o dietista.</p>
    </>
  )
}

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
      {!answers ? (
        <Link to={`/app/${module}/perfil`} className="cta">
          {meta.cta} para personalizar tus recomendaciones
          <small>Toma unos minutos · Tus respuestas son privadas</small>
        </Link>
      ) : (
        <>
          {module === 'ejercicios' && <Exercises plan={plan} />}
          {module === 'nutricion' && <Nutrition a={answers} />}
          {module === 'lesiones' && <Injuries a={answers} />}
          {module === 'suplementos' && <Supplements a={answers} />}
          {module !== 'ejercicios' && <Link to={`/app/${module}/perfil`} className="btn">Editar mis respuestas</Link>}
        </>
      )}
    </>
  )
}