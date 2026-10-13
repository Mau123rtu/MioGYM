import { supabase } from './supabase'
import type { Profile } from '../context/AuthContext'
import { toArr, type Answers } from './questionnaires'

type G = 'pecho' | 'espalda' | 'hombros' | 'brazos' | 'piernas' | 'abdomen'
interface Ex { n: string; g: G; eq: string[]; z: string[] }

export interface PlanExercise { name: string; sets: number; reps: string; rest: number }
export interface PlanDay { weekday: string; name: string; rest: boolean; exercises: PlanExercise[] }
export interface Plan {
  days: PlanDay[]            // semana 1 (compatibilidad)
  weeks?: PlanDay[][]        // las 4 semanas del ciclo
  startDate?: string
  totalWeeks?: number
  notes: string[]
  warnings: string[]
}

const E = (n: string, g: G, eq: string, z = ''): Ex => ({ n, g, eq: eq.split(','), z: z ? z.split(',') : [] })

// z = zonas articulares que el ejercicio carga (para excluirlo si hay molestia ahí)
const CATALOG: Ex[] = [
  E('Press de banca con barra', 'pecho', 'libres', 'hombro,codo'), E('Press con mancuernas', 'pecho', 'libres', 'hombro'),
  E('Press de pecho en máquina', 'pecho', 'maquinas', 'hombro'), E('Cruces en polea', 'pecho', 'poleas', 'hombro'),
  E('Flexiones', 'pecho', 'corporal', 'hombro,codo'), E('Flexiones con banda', 'pecho', 'bandas', 'hombro'),
  E('Jalón al pecho', 'espalda', 'maquinas,poleas', 'hombro'), E('Remo con mancuerna', 'espalda', 'libres', 'espalda'),
  E('Remo en polea baja', 'espalda', 'poleas', 'espalda'), E('Remo con banda', 'espalda', 'bandas', 'espalda'),
  E('Dominadas', 'espalda', 'corporal', 'hombro,codo'), E('Remo invertido', 'espalda', 'corporal', 'hombro'),
  E('Peso muerto rumano', 'espalda', 'libres', 'espalda,cadera'),
  E('Press militar con mancuernas', 'hombros', 'libres', 'hombro'), E('Elevaciones laterales', 'hombros', 'libres', 'hombro'),
  E('Press de hombro en máquina', 'hombros', 'maquinas', 'hombro'), E('Elevaciones laterales con banda', 'hombros', 'bandas', 'hombro'),
  E('Pike push-up', 'hombros', 'corporal', 'hombro,codo'), E('Face pull en polea', 'hombros', 'poleas', 'hombro'),
  E('Curl de bíceps con mancuernas', 'brazos', 'libres', 'codo'), E('Curl de bíceps con banda', 'brazos', 'bandas', 'codo'),
  E('Curl de bíceps en máquina', 'brazos', 'maquinas', 'codo'), E('Extensión de tríceps en polea', 'brazos', 'poleas', 'codo'),
  E('Press francés con mancuerna', 'brazos', 'libres', 'codo'), E('Fondos en banco', 'brazos', 'corporal', 'hombro,codo'),
  E('Sentadilla goblet', 'piernas', 'libres', 'rodilla,cadera,espalda'), E('Prensa de piernas', 'piernas', 'maquinas', 'rodilla,cadera'),
  E('Extensión de cuádriceps', 'piernas', 'maquinas', 'rodilla'), E('Curl femoral en máquina', 'piernas', 'maquinas', 'rodilla'),
  E('Sentadilla con peso corporal', 'piernas', 'corporal', 'rodilla,cadera'), E('Zancadas', 'piernas', 'corporal', 'rodilla,cadera,tobillo'),
  E('Puente de glúteo', 'piernas', 'corporal', 'cadera'), E('Hip thrust con barra', 'piernas', 'libres', 'cadera'),
  E('Sentadilla con banda', 'piernas', 'bandas', 'rodilla,cadera'), E('Elevación de talones', 'piernas', 'corporal', 'tobillo'),
  E('Plancha', 'abdomen', 'corporal', 'hombro'), E('Crunch', 'abdomen', 'corporal', 'cuello'),
  E('Elevación de rodillas', 'abdomen', 'corporal', 'cadera'), E('Crunch en polea', 'abdomen', 'poleas', 'cuello'),
  E('Pallof press con banda', 'abdomen', 'bandas'),
]

const TEMPLATES: Record<string, { name: string; g: G[] }[]> = {
  cuerpo: [{ name: 'Cuerpo completo', g: ['piernas', 'pecho', 'espalda', 'hombros', 'abdomen'] }],
  sup_inf: [{ name: 'Tren superior', g: ['pecho', 'espalda', 'hombros', 'brazos'] }, { name: 'Tren inferior', g: ['piernas', 'abdomen'] }],
  ppl: [{ name: 'Empuje', g: ['pecho', 'hombros', 'brazos'] }, { name: 'Tirón', g: ['espalda', 'brazos'] }, { name: 'Piernas', g: ['piernas', 'abdomen'] }],
}
const SINGLE: G[] = ['pecho', 'espalda', 'piernas', 'hombros', 'brazos', 'abdomen']
const GNAME: Record<G, string> = { pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', brazos: 'Brazos', piernas: 'Piernas y glúteos', abdomen: 'Abdomen' }
const SETS: Record<string, [number, string]> = {
  hipertrofia: [3, '8–12'], fuerza: [4, '4–6'], resistencia: [3, '15–20'],
  calistenia: [3, '8–15'], funcional: [3, '10–12'], combinacion: [3, '8–12'],
}

function pick(list: Ex[], k: number, used: Set<string>) {
  for (let t = 0; t < list.length; t++) {
    const e = list[(k + t) % list.length]
    if (!used.has(e.n)) { used.add(e.n); return e }
  }
  return null
}

export function generateRoutine(p: Profile, r: Answers, inj: Answers | null): Plan {
  const warnings: string[] = []
  const notes: string[] = []

  // REGLA DE SEGURIDAD 1: síntomas de alarma → no se genera rutina
  if (inj?.alarma === 'si') {
    return {
      days: [], notes: [],
      warnings: ['Indicaste dolor de pecho, desmayos o dificultad importante para respirar al ejercitarte. Detén el ejercicio y busca atención médica urgente. No generamos una rutina hasta que un profesional te valore.'],
    }
  }

  // REGLA DE SEGURIDAD 2: zonas con molestia → se excluyen ejercicios que las carguen
  const blocked = new Set<string>()
  if (inj?.dolor === 'si') {
    toArr(inj.zonas).forEach(z => blocked.add(z))
    if (inj.intensidad === 'intenso' || toArr(inj.situaciones).includes('reposo'))
      warnings.push('Tu molestia es intensa o aparece en reposo. Te recomendamos que un profesional sanitario la valore antes de cargar esa zona.')
    else if (inj.evaluada === 'no')
      warnings.push('Tu molestia no ha sido evaluada. Evitamos ejercicios que carguen esa zona; considera una valoración profesional.')
    if (toArr(inj.zonas).includes('otra'))
      warnings.push('Indicaste "otra zona": no podemos filtrar ejercicios automáticamente. Evita cualquier movimiento que te duela.')
  }
  if (inj?.dolor === 'nose') warnings.push('Si aparece dolor al entrenar, detente. Si persiste, consulta a un profesional.')
  if (inj?.previas === 'limitaciones' || inj?.indicaciones === 'si')
    warnings.push(`Tienes restricciones o indicaciones profesionales${inj.restricciones || inj.indicaciones_detalle ? ` (${inj.restricciones ?? inj.indicaciones_detalle})` : ''}. Revisa cada ejercicio con tu profesional antes de hacerlo.`)

  // Equipo
  let eq = new Set<string>([...toArr(r.equipo).filter(x => x !== 'otro'), 'corporal'])
  if (r.tipo === 'calistenia') eq = new Set(['corporal'])

  const candidates = (g: G) =>
    CATALOG.filter(e => e.g === g && e.eq.some(x => eq.has(x)) && !e.z.some(z => blocked.has(z)))

  // Frecuencia y estructura
  const exp = p.experience
  const days = ({ '1-2': 2, '3-4': exp === 'principiante' ? 3 : 4, '5-6': 5, '7': 6 } as Record<string, number>)[p.days_per_week ?? '3-4'] ?? 3
  let st = r.estructura
  if (!st || st === 'auto') st = days <= 3 ? 'cuerpo' : days === 4 ? 'sup_inf' : exp === 'principiante' ? 'sup_inf' : 'ppl'

  const prio = toArr(r.grupos).filter(g => g !== 'todo') as G[]
  let templates = TEMPLATES[st]
  if (st === 'grupo') {
    const ordered = [...SINGLE.filter(g => prio.includes(g)), ...SINGLE.filter(g => !prio.includes(g))]
    templates = ordered.map(g => ({ name: GNAME[g], g: [g] }))
  }

  // Ejercicios por sesión, series y repeticiones
  let count = ({ '20-30': 4, '30-45': 5, '45-60': 6, '60-90': 8, '90+': 9 } as Record<string, number>)[r.tiempo] ?? 5
  if (r.estilo === 'largas') count += 1
  if (r.recuperacion === 'agotado') count = Math.max(3, count - 1)
  let [sets, reps] = SETS[r.tipo] ?? [3, '8–12']
  if (exp === 'principiante' || r.tiempo_entrenando === 'nunca' || r.tiempo_entrenando === 'menos6') {
    sets = Math.min(sets, 3); if (r.tipo === 'fuerza') reps = '6–8'
  }
  if (r.recuperacion === 'agotado') sets = Math.max(2, sets - 1)

  const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const PATTERN: Record<number, number[]> = {
    1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5],
  }
  // Descanso entre series (segundos) según el tipo de ejercicio
  const restFor = (g: G): number => {
    if (g === 'abdomen' || r.tipo === 'resistencia') return 45
    const big = g === 'piernas' || g === 'espalda' || g === 'pecho'
    if (r.tipo === 'fuerza') return big ? 150 : 90
    return big ? 90 : 60
  }

  const buildWeek = (shift: number): PlanDay[] => {
    const trained: { name: string; exercises: PlanExercise[] }[] = []
    for (let d = 0; d < days; d++) {
      const t = templates[d % templates.length]
      const variant = Math.floor(d / templates.length) + shift
      const gs = [...t.g.filter(g => prio.includes(g)), ...t.g.filter(g => !prio.includes(g))]
      const used = new Set<string>()
      const exercises: PlanExercise[] = []
      for (let i = 0; i < count * 3 && exercises.length < count; i++) {
        const g = gs[i % gs.length]
        const e = pick(candidates(g), variant * 2 + Math.floor(i / gs.length), used)
        if (e) exercises.push({
          name: e.n,
          sets: g === 'abdomen' ? Math.min(sets, 3) : sets,
          reps: g === 'abdomen' ? '30–45 s / 12–20' : reps,
          rest: restFor(g),
        })
      }
      trained.push({ name: t.name, exercises })
    }
    const slots = PATTERN[days] ?? PATTERN[3]
    return WEEKDAYS.map((w, idx) => {
      const k = slots.indexOf(idx)
      if (k === -1) return { weekday: w, name: `${w} · Descanso`, rest: true, exercises: [] }
      return { weekday: w, name: `${w} · ${trained[k].name}`, rest: false, exercises: trained[k].exercises }
    })
  }

  // 4 semanas: los ejercicios cambian en la semana 3
  const weeks = [0, 1, 2, 3].map(w => buildWeek(Math.floor(w / 2)))

  notes.push('Sigue esta rutina 4 semanas. Las semanas 1–2 usan un grupo de ejercicios y las semanas 3–4 otro. Al terminar el mes empieza un nuevo ciclo.')
  if (r.recuperacion === 'agotado') notes.push('Te sientes agotado con frecuencia: reducimos el volumen. Prioriza dormir y descansar; si persiste, consulta a un profesional.')
  if (r.recuperacion === 'a_veces') notes.push('Respeta los días de descanso antes de repetir los mismos músculos.')
  if (r.estilo === 'cortas') notes.push('Para sesiones cortas, respeta los descansos sin sacrificar la técnica.')
  notes.push('Cargas: elige un peso con el que terminarías cada serie con 2–3 repeticiones en reserva. Regístralo y súbelo poco a poco cuando completes todas las repeticiones con buena técnica.')

  return { days: weeks[0], weeks, startDate: new Date().toISOString(), totalWeeks: 4, notes, warnings }
}

/** Regenera la rutina con las respuestas guardadas (se llama al terminar rutinas o lesiones). */
export async function regenerateRoutine(userId: string, profile: Profile | null) {
  if (!profile) return
  const { data } = await supabase.from('module_profiles').select('module,answers').in('module', ['rutinas', 'lesiones'])
  const rut = data?.find(d => d.module === 'rutinas')?.answers
  const les = data?.find(d => d.module === 'lesiones')?.answers ?? null
  if (!rut) return
  const plan = generateRoutine(profile, rut, les)
  // conserva la fecha de inicio del ciclo si ya existía
  const old = await supabase.from('routines').select('plan').maybeSingle()
  if (old.data?.plan?.startDate) plan.startDate = old.data.plan.startDate
  await supabase.from('routines').upsert({ user_id: userId, plan }, { onConflict: 'user_id' })
}

/** Semana actual del ciclo, días de esa semana y fecha de fin del ciclo */
export function planProgress(plan: Plan) {
  const s = plan.startDate ? new Date(plan.startDate) : new Date()
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)) // lunes de la semana de inicio
  const total = plan.totalWeeks ?? 4
  const elapsed = Math.max(0, Math.floor((Date.now() - s.getTime()) / (7 * 86400000)))
  const week = elapsed % total
  const weeks = plan.weeks ?? [plan.days]
  const cycle = Math.floor(elapsed / total) + 1
  const end = new Date(s.getTime() + cycle * total * 7 * 86400000 - 86400000)
  return {
    week, weekNumber: week + 1, total, cycle, end,
    days: weeks[Math.min(week, weeks.length - 1)],
    todayIdx: (new Date().getDay() + 6) % 7,
  }
}