import { CATALOG, type G, type PlanExercise } from './routine'
import { toArr, type Answers } from './questionnaires'
import type { Profile } from '../context/AuthContext'

export interface AiDay { name: string; groups: G[]; exercises: PlanExercise[] }
export interface AiResult {
  days: AiDay[]
  why: string
  freq: Partial<Record<G, number>>
  warnings: string[]
  stop?: string
}

interface Tpl { name: string; g: G[] }
const UPPER: G[] = ['pecho', 'espalda', 'hombros', 'brazos']
const FULL: G[] = ['piernas', 'pecho', 'espalda', 'hombros', 'abdomen']
const LEGS: G[] = ['piernas', 'abdomen']

const SPLITS: Record<number, Tpl[]> = {
  2: [{ name: 'Torso', g: UPPER }, { name: 'Piernas y abdomen', g: LEGS }],
  3: [{ name: 'Empuje', g: ['pecho', 'hombros', 'brazos'] }, { name: 'Tirón', g: ['espalda', 'brazos'] }, { name: 'Piernas y abdomen', g: LEGS }],
  4: [{ name: 'Torso', g: UPPER }, { name: 'Piernas', g: LEGS }, { name: 'Torso', g: UPPER }, { name: 'Piernas', g: LEGS }],
  5: [{ name: 'Pecho y hombros', g: ['pecho', 'hombros', 'brazos'] }, { name: 'Espalda y brazos', g: ['espalda', 'brazos'] },
      { name: 'Piernas', g: ['piernas'] }, { name: 'Torso', g: UPPER }, { name: 'Piernas y abdomen', g: LEGS }],
  6: [{ name: 'Empuje', g: ['pecho', 'hombros', 'brazos'] }, { name: 'Tirón', g: ['espalda', 'brazos'] }, { name: 'Piernas', g: LEGS },
      { name: 'Empuje', g: ['pecho', 'hombros', 'brazos'] }, { name: 'Tirón', g: ['espalda', 'brazos'] }, { name: 'Piernas', g: LEGS }],
}
const WHY: Record<number, string> = {
  2: 'Con 2 días, Torso y Piernas te permiten entrenar todo el cuerpo cada semana.',
  3: 'Con 3 días, Empuje / Tirón / Piernas reparte los músculos sin juntar los que se fatigan entre sí.',
  4: 'Con 4 días, dos sesiones de torso y dos de piernas: cada músculo se entrena 2 veces por semana con descanso entre sesiones.',
  5: 'Con 5 días combinamos pecho con hombros, espalda con brazos, y piernas dos veces por semana.',
  6: 'Con 6 días, Empuje / Tirón / Piernas dos veces: cada grupo se entrena 2 veces por semana.',
}

const RANK: Record<G, number> = { piernas: 0, espalda: 0, pecho: 0, hombros: 1, brazos: 2, abdomen: 2 }
const BIG: G[] = ['piernas', 'espalda', 'pecho']
const SETS: Record<string, [number, string]> = {
  hipertrofia: [3, '8–12'], fuerza: [4, '4–6'], resistencia: [3, '15–20'],
  calistenia: [3, '8–15'], funcional: [3, '10–12'], combinacion: [3, '8–12'],
}
const PLACE: Record<string, string[]> = {
  gimnasio: ['maquinas', 'libres', 'poleas', 'bandas', 'corporal'],
  casa: ['corporal'], casa_basico: ['libres', 'bandas', 'corporal'], aire_libre: ['corporal', 'bandas'],
}
const NAME: Record<G, string> = {
  pecho: 'pecho', espalda: 'espalda', hombros: 'hombros', brazos: 'brazos', piernas: 'piernas', abdomen: 'abdomen',
}

export function generateAi(o: {
  profile: Profile; rut: Answers | null; inj: Answers | null; days: number; focus: G[]; seed: number
}): AiResult {
  const { profile: p, rut, inj, days, focus, seed } = o
  const warnings: string[] = []

  // Seguridad: síntomas de alarma → no se genera nada
  if (inj?.alarma === 'si')
    return { days: [], why: '', freq: {}, warnings: [], stop: 'Indicaste dolor de pecho, desmayos o dificultad importante para respirar al ejercitarte. Detén el ejercicio y busca atención médica urgente. No generamos rutinas hasta que un profesional te valore.' }

  // Seguridad: zonas con molestia
  const blocked = new Set<string>()
  if (inj?.dolor === 'si') {
    toArr(inj.zonas).forEach(z => blocked.add(z))
    warnings.push(`Evitamos ejercicios que carguen: ${toArr(inj.zonas).join(', ')}.`)
    if (inj.intensidad === 'intenso' || toArr(inj.situaciones).includes('reposo'))
      warnings.push('Tu molestia es intensa o aparece en reposo: te recomendamos una valoración profesional antes de cargar esa zona.')
    if (toArr(inj.zonas).includes('otra'))
      warnings.push('Indicaste "otra zona": no podemos filtrar ejercicios automáticamente. Evita todo movimiento que te duela.')
  }
  if (inj?.previas === 'limitaciones' || inj?.indicaciones === 'si')
    warnings.push('Tienes restricciones o indicaciones profesionales. Revisa cada ejercicio con tu profesional.')

  // Equipo
  let eq = new Set<string>(rut ? [...toArr(rut.equipo).filter(x => x !== 'otro'), 'corporal'] : PLACE[p.training_place ?? ''] ?? ['corporal'])
  if (rut?.tipo === 'calistenia') eq = new Set(['corporal'])

  const beginner = p.experience === 'principiante' || ['nunca', 'menos6'].includes(rut?.tiempo_entrenando)
  if (days >= 6 && beginner)
    warnings.push('Seis días a la semana es mucho para empezar. Si te sientes cansado, prueba con 3 o 4 días.')

  const tpls: Tpl[] = beginner && days <= 3
    ? Array.from({ length: days }, (_, i) => ({ name: 'Cuerpo completo', g: FULL, _i: i }))
    : SPLITS[Math.min(6, Math.max(2, days))]

  // Volumen
  let count = ({ '20-30': 4, '30-45': 5, '45-60': 6, '60-90': 8, '90+': 9 } as Record<string, number>)[rut?.tiempo] ?? 6
  if (rut?.estilo === 'largas') count += 1
  if (rut?.recuperacion === 'agotado') count = Math.max(3, count - 1)
  let [sets, reps] = SETS[rut?.tipo] ?? [3, '8–12']
  if (beginner) sets = Math.min(sets, 3)
  if (rut?.recuperacion === 'agotado') sets = Math.max(2, sets - 1)

  const restFor = (g: G) => {
    if (g === 'abdomen' || rut?.tipo === 'resistencia') return 45
    if (BIG.includes(g)) return rut?.tipo === 'fuerza' ? 150 : 90
    return rut?.tipo === 'fuerza' ? 90 : 60
  }

  const use: Record<string, number> = {}
  const seen: Record<string, number> = {}
  const missing = new Set<G>()

  const pickEx = (g: G, today: Set<string>) => {
    const list = CATALOG.filter(e => e.g === g && e.eq.some(x => eq.has(x)) && !e.z.some(z => blocked.has(z)) && !today.has(e.n))
    if (!list.length) return null
    const r = seed % list.length
    const rot = [...list.slice(r), ...list.slice(0, r)]
    rot.sort((a, b) => (use[a.n] ?? 0) - (use[b.n] ?? 0))
    use[rot[0].n] = (use[rot[0].n] ?? 0) + 1
    return rot[0]
  }

  const out: AiDay[] = tpls.map(t => {
    const nth = (seen[t.name] = (seen[t.name] ?? 0) + 1)
    const name = nth > 1 ? `${t.name} ${String.fromCharCode(64 + nth)}` : t.name
    const order = [...t.g.filter(g => focus.includes(g)), ...t.g.filter(g => !focus.includes(g))]
    const tokens: G[] = []
    order.forEach(g => { tokens.push(g); if (focus.includes(g) && g !== 'abdomen') tokens.push(g) })

    const today = new Set<string>()
    const per: Partial<Record<G, number>> = {}
    const picked: { g: G; n: string }[] = []
    for (let i = 0; i < count * 4 && picked.length < count; i++) {
      const g = tokens[i % tokens.length]
      if ((per[g] ?? 0) >= (g === 'abdomen' ? 2 : 4)) continue
      const e = pickEx(g, today)
      if (!e) { missing.add(g); continue }
      today.add(e.n); per[g] = (per[g] ?? 0) + 1
      picked.push({ g, n: e.n })
    }
    picked.sort((a, b) => RANK[a.g] - RANK[b.g]) // estable: grandes primero

    const exercises: PlanExercise[] = picked.map(x => ({
      name: x.n,
      sets: x.g === 'abdomen' ? Math.min(sets, 3) : sets,
      reps: x.g === 'abdomen' ? '30–45 s / 12–20' : reps,
      rest: restFor(x.g),
    }))
    return { name, groups: Array.from(new Set(picked.map(x => x.g))), exercises }
  })

  

  missing.forEach(g => warnings.push(`No encontramos ejercicios de ${NAME[g]} compatibles con tu equipo o con tus zonas con molestia.`))

  const freq: Partial<Record<G, number>> = {}
  out.forEach(d => d.groups.forEach(g => { freq[g] = (freq[g] ?? 0) + 1 }))

  let why = beginner && days <= 3
    ? 'Al ser principiante con pocos días, el cuerpo completo repetido cada semana te ayuda a aprender los movimientos y a progresar más rápido.'
    : WHY[Math.min(6, Math.max(2, days))]
  if (focus.length) why += ' Los músculos que priorizaste reciben más ejercicios.'
  return { days: out, why, freq, warnings }


  
}


/** Busca otro ejercicio compatible del mismo músculo para reemplazar uno de la propuesta */
export function swapExercise(o: {
  profile: Profile; rut: Answers | null; inj: Answers | null; current: string; dayNames: string[]
}): string | null {
  const cur = CATALOG.find(e => e.n === o.current)
  if (!cur) return null
  const blocked = new Set<string>(o.inj?.dolor === 'si' ? toArr(o.inj.zonas) : [])
  let eq = new Set<string>(o.rut
    ? [...toArr(o.rut.equipo).filter(x => x !== 'otro'), 'corporal']
    : PLACE[o.profile.training_place ?? ''] ?? ['corporal'])
  if (o.rut?.tipo === 'calistenia') eq = new Set(['corporal'])
  const alts = CATALOG.filter(e =>
    e.g === cur.g && e.n !== cur.n && !o.dayNames.includes(e.n) &&
    e.eq.some(x => eq.has(x)) && !e.z.some(z => blocked.has(z)))
  if (!alts.length) return null
  return alts[Math.floor(Math.random() * alts.length)].n
}