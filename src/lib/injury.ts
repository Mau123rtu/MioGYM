import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Profile } from '../context/AuthContext'
import type { Answers } from './questionnaires'
import { CATALOG, regenerateRoutine, type Ex } from './routine'

export type Level = 'ok' | 'adjust' | 'rest' | 'urgent'
export type ZoneKey = 'cuello' | 'hombro' | 'codo' | 'espalda' | 'cadera' | 'rodilla' | 'tobillo' | 'otra'
export type Mode = 'ok' | 'adjust' | 'blocked'

export const ZONES: [ZoneKey, string][] = [
  ['cuello', 'Cuello'], ['hombro', 'Hombro'], ['codo', 'Codo o muñeca'], ['espalda', 'Espalda'],
  ['cadera', 'Cadera'], ['rodilla', 'Rodilla'], ['tobillo', 'Tobillo o pie'], ['otra', 'Otra zona'],
]
export const ZONE_LABEL: Record<string, string> = Object.fromEntries(ZONES)

export const PARTS: Record<ZoneKey, string[]> = {
  cuello: ['Lados del cuello', 'Parte de atrás', 'Base del cuello y hombros', 'Baja hacia el brazo'],
  hombro: ['Parte delantera', 'Parte superior', 'Parte trasera', 'Profundo, dentro de la articulación', 'No sé'],
  codo: ['Codo, por fuera', 'Codo, por dentro', 'Muñeca', 'Mano o dedos'],
  espalda: ['Zona baja (lumbar)', 'Zona media', 'Zona alta, entre los omóplatos', 'Músculos de un lado', 'No sé'],
  cadera: ['Ingle o parte delantera', 'Lateral (hueso de la cadera)', 'Glúteo', 'Parte trasera del muslo (isquios)', 'No sé'],
  rodilla: ['Delante, alrededor de la rótula', 'Por dentro', 'Por fuera', 'Por detrás', 'Muslo (cuádriceps o isquios)', 'No sé'],
  tobillo: ['Tobillo, por fuera', 'Tobillo, por dentro', 'Talón o tendón de Aquiles', 'Planta o arco', 'Empeine o dedos', 'Pantorrilla'],
  otra: [],
}

export const SIDES: [string, string][] = [['izq', 'Izquierdo'], ['der', 'Derecho'], ['ambos', 'Ambos lados'], ['centro', 'Centro / no aplica']]
export const KINDS: [string, string][] = [
  ['punzante', 'Punzante, como un pinchazo'], ['sordo', 'Sordo o molestia constante'], ['tiron', 'Tirón o contractura'],
  ['ardor', 'Ardor, corriente o eléctrico'], ['rigidez', 'Rigidez'], ['otro', 'No sé describirlo'],
]
export const ONSETS: [string, string][] = [
  ['golpe', 'Golpe, caída o torcedura'], ['esfuerzo', 'De repente, haciendo un esfuerzo'], ['gradual', 'Poco a poco'], ['nose', 'No sé'],
]
export const DURATIONS: [string, string][] = [['dias', 'Menos de 1 semana'], ['semanas', 'Entre 1 y 4 semanas'], ['mes', 'Más de 4 semanas']]
export const TRENDS: [string, string][] = [['peor', 'Está peor'], ['igual', 'Igual'], ['mejor', 'Está mejorando']]
export const TRIGGERS: [string, string][] = [
  ['peso', 'Levantar peso'], ['encima', 'Movimientos por encima de la cabeza'], ['flexion', 'Doblar o estirar la zona'],
  ['impacto', 'Caminar, correr o saltar'], ['reposo', 'También me duele en reposo'], ['noche', 'Me despierta de noche'],
  ['toser', 'Toser, estornudar o hacer fuerza al ir al baño'],
]

export interface FlagDef { id: string; label: string; cls: 'emergency' | 'urgent' | 'major' }
export const FLAGS: FlagDef[] = [
  { id: 'pecho', label: 'Dolor u opresión en el pecho, falta de aire importante, mareo intenso o desmayo', cls: 'emergency' },
  { id: 'esfinter', label: 'Adormecimiento en la entrepierna o pérdida de control de la orina o las heces', cls: 'emergency' },
  { id: 'deformidad', label: 'La zona se ve deformada o fuera de lugar', cls: 'urgent' },
  { id: 'no_apoyo', label: 'No puedo apoyar el peso o usar la zona después de un golpe o caída', cls: 'urgent' },
  { id: 'fiebre', label: 'La zona está roja, caliente e hinchada, y tengo fiebre', cls: 'urgent' },
  { id: 'debilidad_subita', label: 'Perdí fuerza de repente en un brazo o una pierna', cls: 'urgent' },
  { id: 'chasquido', label: 'Sentí un chasquido o "pop" al lastimarme', cls: 'major' },
  { id: 'hinchazon', label: 'Hay hinchazón visible', cls: 'major' },
  { id: 'inestable', label: 'La zona se siente inestable o "se me sale"', cls: 'major' },
  { id: 'hormigueo', label: 'Siento hormigueo o adormecimiento', cls: 'major' },
  { id: 'irradia', label: 'El dolor baja por el brazo o la pierna', cls: 'major' },
  { id: 'debilidad', label: 'Tengo menos fuerza que del otro lado', cls: 'major' },
]

export interface TestDef { id: string; title: string; how: string }
const T = (id: string, title: string, how: string): TestDef => ({ id, title, how })
const STEPS10 = T('pasos', 'Caminar 10 pasos', 'Camina 10 pasos a tu ritmo normal, sin cargar nada.')
const SQUAT = T('sentadilla', 'Sentadilla parcial', 'Pies al ancho de los hombros, baja hasta la mitad de una sentadilla sin peso, 5 veces, y sujétate de algo si lo necesitas.')
export const TESTS: Record<ZoneKey, TestDef[]> = {
  cuello: [
    T('giro', 'Girar la cabeza', 'Sentado y con la espalda recta, gira despacio la cabeza hacia un lado y luego al otro, sin forzar.'),
    T('inclina', 'Inclinar el cuello', 'Lleva la oreja hacia el hombro de cada lado, despacio y sin ayudarte con la mano.'),
    T('barbilla', 'Barbilla al pecho', 'Baja la barbilla hacia el pecho y vuelve, despacio y sin rebotes.'),
  ],
  hombro: [
    T('lateral', 'Subir el brazo de lado', 'De pie, sube el brazo estirado hacia el lado hasta la altura del hombro y baja, sin peso.'),
    T('encima', 'Brazo sobre la cabeza', 'Sube el brazo por delante hasta arriba, sin peso. Si duele antes de llegar, detente.'),
    T('espalda', 'Mano a la espalda', 'Lleva la mano hacia la espalda baja, como para alcanzar un bolsillo trasero.'),
  ],
  codo: [
    T('flex', 'Doblar y estirar el codo', 'Dobla y estira el codo por completo 5 veces, sin peso.'),
    T('giro', 'Girar el antebrazo', 'Con el codo pegado al cuerpo, gira la palma hacia arriba y hacia abajo 5 veces.'),
    T('agarre', 'Apretar con la mano', 'Aprieta una toalla enrollada con fuerza moderada durante 5 segundos.'),
  ],
  espalda: [
    T('inclina', 'Inclinarte hacia adelante', 'De pie, baja las manos hacia las rodillas hasta donde sea cómodo y sube despacio.'),
    T('extiende', 'Arquear suave hacia atrás', 'De pie, con las manos en la cintura, inclínate un poco hacia atrás, despacio.'),
    T('gira', 'Giro de tronco', 'Sentado, gira el torso hacia cada lado con los brazos cruzados sobre el pecho.'),
  ],
  cadera: [
    SQUAT,
    T('rodilla_pecho', 'Rodilla al pecho', 'Acostado, lleva una rodilla hacia el pecho y luego la otra, sin forzar.'),
    STEPS10,
  ],
  rodilla: [
    SQUAT,
    T('escalon', 'Subir y bajar un escalón', 'Sube y baja un escalón bajo 5 veces con cada pierna, agarrado de algo si lo necesitas.'),
    T('flexion', 'Doblar y estirar la rodilla', 'Sentado, estira la rodilla del todo y luego dóblala lo más que puedas, 5 veces.'),
  ],
  tobillo: [
    STEPS10,
    T('puntas', 'Ponerte de puntas', 'Sujeto a una pared, sube sobre las puntas de los pies y baja, 5 veces.'),
    T('circulos', 'Círculos con el tobillo', 'Sentado, dibuja círculos con el pie en ambos sentidos.'),
  ],
  otra: [
    T('mover', 'Mover la zona con suavidad', 'Mueve con suavidad la zona afectada en las direcciones que sean cómodas.'),
    T('uso', 'Usarla sin peso', 'Haz un movimiento sencillo de tu día a día con esa zona, sin cargar nada.'),
  ],
}
export const TEST_OPTIONS: [number, string][] = [
  [0, 'Sin dolor'], [1, 'Molestia leve (1 a 3)'], [2, 'Dolor fuerte (4 o más)'], [3, 'No pude hacerla'], [-1, 'Prefiero no hacerla'],
]

/* ---------- Evaluación ---------- */
export interface Check {
  zone: ZoneKey; part: string; side: string; pain: number; kind: string
  onset: string; duration: string; trend: string
  triggers: string[]; flags: string[]
  tests: { id: string; title: string; score: number | null }[]
}
export interface Result { level: Level; reasons: string[]; steps: string[]; confidence: 'baja' | 'media'; points: number }

export const painLabel = (p: number) => (p === 0 ? 'Sin dolor' : p <= 3 ? 'Leve' : p <= 6 ? 'Moderado' : 'Intenso')
export const painAdvice = (p: number) =>
  p <= 3 ? 'Es una molestia leve. Puedes continuar con menos carga, buena técnica y descansos más largos.'
  : p <= 5 ? 'Dolor moderado: baja la carga a la mitad, reduce el recorrido si te ayuda, o salta este ejercicio.'
  : p === 6 ? 'Dolor considerable: lo prudente es no seguir con este ejercicio. Si persiste, evalúalo en Prevención.'
  : 'Dolor intenso: detén el entrenamiento. Si no baja pronto o aparece hormigueo, hinchazón o pérdida de fuerza, consulta a un médico.'

export function evaluate(c: Check): Result {
  const reasons: string[] = []
  const pick = (cls: FlagDef['cls']) => FLAGS.filter(f => f.cls === cls && c.flags.includes(f.id))
  const emergency = pick('emergency'), urgent = pick('urgent'), major = pick('major')
  const answered = c.tests.filter(t => t.score !== null)
  const cant = answered.filter(t => t.score === 3).length
  const strong = answered.filter(t => t.score === 2).length
  const mild = answered.filter(t => t.score === 1).length
  const rest = c.triggers.includes('reposo'), night = c.triggers.includes('noche')
  const confidence: Result['confidence'] = answered.length >= 2 ? 'media' : 'baja'

  if (emergency.length || urgent.length) {
    const steps = emergency.length
      ? ['Si tienes dolor de pecho, falta de aire importante o desmayo, llama ahora a emergencias o acude a urgencias.', 'No entrenes y no hagas esfuerzos hasta que te valore un médico.']
      : ['Busca atención médica hoy (urgencias o consulta urgente).', 'No entrenes ni cargues la zona hasta que te valore un médico.']
    return {
      level: 'urgent', confidence, points: 99, steps,
      reasons: [...emergency, ...urgent].map(f => `Marcaste: ${f.label}.`),
    }
  }

  let pts = 0
  if (c.pain >= 7) { pts += 4; reasons.push(`Dolor alto (${c.pain}/10).`) }
  else if (c.pain >= 5) { pts += 2; reasons.push(`Dolor moderado (${c.pain}/10).`) }
  else if (c.pain >= 3) { pts += 1; reasons.push(`Molestia de ${c.pain}/10.`) }
  if (rest) { pts += 2; reasons.push('Te duele en reposo; eso no es lo típico de una simple fatiga muscular.') }
  if (night) { pts += 2; reasons.push('El dolor te despierta de noche.') }
  if (major.length) { pts += Math.min(4, major.length * 2); reasons.push(`Señales a vigilar: ${major.map(f => f.label.toLowerCase()).join('; ')}.`) }
  if (c.onset === 'golpe' && c.pain >= 4) { pts += 2; reasons.push('Empezó con un golpe, caída o torcedura.') }
  if (c.onset === 'esfuerzo' && c.pain >= 5) { pts += 1; reasons.push('Apareció de golpe durante un esfuerzo.') }
  if (c.duration === 'mes' && c.pain >= 4) { pts += 1; reasons.push('Lleva más de 4 semanas con dolor moderado o más.') }
  if (c.trend === 'peor') { pts += 1; reasons.push('Va empeorando.') }
  if (c.trend === 'mejor' && pts > 0) pts -= 1
  if (c.kind === 'ardor') { pts += 1; reasons.push('El dolor tipo corriente o ardor puede indicar irritación de un nervio.') }
  if (c.triggers.includes('toser') && (c.zone === 'espalda' || c.zone === 'cuello')) { pts += 1; reasons.push('Empeora al toser o hacer fuerza.') }
  if (cant) { pts += Math.min(4, cant * 2); reasons.push('No pudiste completar algunas pruebas de movimiento.') }
  if (strong) { pts += Math.min(3, strong); reasons.push('Algunas pruebas te dolieron fuerte.') }
  if (mild && !strong && !cant) { pts += 1; reasons.push('Las pruebas dieron molestia leve.') }
  if (answered.length === 0) reasons.push('No hicimos pruebas de movimiento, así que el resultado es menos preciso.')

  let level: Level = 'ok'
  if (pts >= 2 || c.pain >= 3 || mild + strong + cant > 0) level = 'adjust'
  if (pts >= 5 || c.pain >= 8 || (rest && c.pain >= 4) || major.length >= 2 || (cant >= 1 && c.pain >= 3)) level = 'rest'
  if (level === 'ok' && reasons.length === 0) reasons.push('Dolor bajo y sin señales de alarma.')

  const steps = level === 'rest'
    ? ['Descansa la zona y evita entrenar hasta que te valore un médico o fisioterapeuta.',
       'Si el dolor baja mucho y desaparecen las señales, puedes repetir la evaluación o indicar que fue falsa alarma.',
       'Si aparece hormigueo, pérdida de fuerza o el dolor aumenta, busca atención médica pronto.']
    : []
  return { level, reasons, steps, confidence, points: pts }
}

/* ---------- Ajustes de entrenamiento ---------- */
export function adjustments(level: Level, pain: number) {
  if (level === 'adjust') return { loadFactor: pain >= 5 ? 0.5 : 0.65, restBonus: 30, setsLess: 1, painStop: 3 }
  return { loadFactor: 0.9, restBonus: 15, setsLess: 0, painStop: 3 }
}
export const suggestKg = (last: number, factor: number) => Math.max(0, Math.round(last * factor * 2) / 2)
export const loadsZone = (exercise: string, zones: string[]) =>
  zones.length > 0 && !!CATALOG.find(e => e.n === exercise)?.z.some(z => zones.includes(z))

/* ---------- Reportes y estado ---------- */
export interface Override { type: 'doctor' | 'false_alarm'; note: string; full: boolean; pain?: number; at: string }
export interface Report {
  id: number; zone: ZoneKey; part: string | null; side: string | null; pain: number
  details: Check; level: Level; result: Result; paused: boolean; override: Override | null
  status: 'active' | 'resolved'; created_at: string; updated_at: string
}

export function modeOf(r: Report): { mode: Mode; why: 'paused' | 'override' | 'level' } {
  if (r.paused) return { mode: 'blocked', why: 'paused' }
  if (r.override) return { mode: r.override.type === 'doctor' && r.override.full ? 'ok' : 'adjust', why: 'override' }
  if (r.level === 'urgent' || r.level === 'rest') return { mode: 'blocked', why: 'level' }
  return { mode: r.level === 'adjust' ? 'adjust' : 'ok', why: 'level' }
}

export function summarize(reports: Report[]) {
  const items = reports.filter(r => r.status === 'active').map(r => ({ r, m: modeOf(r) }))
  const blocked = items.filter(x => x.m.mode === 'blocked')
  const adjust = items.filter(x => x.m.mode === 'adjust')
  const ok = items.filter(x => x.m.mode === 'ok')
  const mode: Mode | 'free' = blocked.length ? 'blocked' : adjust.length ? 'adjust' : ok.length ? 'ok' : 'free'
  const touching = items.filter(x => x.m.mode !== 'ok')
  const zones = Array.from(new Set(touching.map(x => x.r.zone))) as string[]
  const worstPain = Math.max(0, ...touching.map(x => x.r.pain))
  const adj = adjust.length
    ? adjust.map(x => (x.r.override ? adjustments('adjust', Math.min(x.r.pain, 4)) : adjustments('adjust', x.r.pain)))
    : [adjustments('ok', 0)]
  return {
    mode, items, blocked, zones, worstPain,
    loadFactor: Math.min(...adj.map(a => a.loadFactor)),
    restBonus: Math.max(...adj.map(a => a.restBonus)),
    setsLess: Math.max(...adj.map(a => a.setsLess)),
    painStop: 3,
  }
}
export type Summary = ReturnType<typeof summarize>

export const injuryChanged = () => window.dispatchEvent(new Event('injury-changed'))

export function useInjury() {
  const [reports, setReports] = useState<Report[] | null>(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('injury_reports').select('*').order('created_at', { ascending: false })
    setReports((data as Report[]) ?? [])
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('injury-changed', load)
    return () => window.removeEventListener('injury-changed', load)
  }, [load])
  return { reports, loading: reports === null, summary: summarize(reports ?? []) }
}

/** Pasa las zonas con molestia al perfil de prevención y regenera el plan automático */
export async function syncInjuries(userId: string, profile: Profile | null) {
  const { data } = await supabase.from('injury_reports').select('*').eq('status', 'active')
  const s = summarize((data as Report[]) ?? [])
  const cur = await supabase.from('module_profiles').select('answers').eq('module', 'lesiones').maybeSingle()
  const a: Answers = { ...(cur.data?.answers ?? {}) }
  if (s.zones.length) {
    a.dolor = 'si'; a.zonas = s.zones
    a.intensidad = s.worstPain >= 7 ? 'intenso' : s.worstPain >= 4 ? 'moderado' : 'leve'
    a.evaluada = 'no'
  } else {
    a.dolor = 'no'; delete a.zonas; delete a.intensidad; delete a.evaluada
  }
  await supabase.from('module_profiles').upsert(
    { user_id: userId, module: 'lesiones', answers: a, updated_at: new Date().toISOString() }, { onConflict: 'user_id,module' })
  await regenerateRoutine(userId, profile)
}


export type Fit = 'ok' | 'care' | 'avoid'

/** Cómo encaja un ejercicio con una molestia concreta */
export function fitFor(exZones: string[], r: Report): Fit {
  if (!exZones.includes(r.zone)) return 'ok'
  const m = modeOf(r)
  if (m.mode === 'ok') return 'ok'                 // médico autorizó sin restricciones
  if (r.override) return 'care'                    // autorización con restricciones o falsa alarma
  return r.pain <= 3 ? 'care' : 'avoid'
}

/** Clasifica todo el catálogo según tus molestias activas (las bloqueadas se ignoran: ahí no se entrena) */
export function exerciseAdvice(reports: Report[]) {
  const act = reports.filter(r => r.status === 'active' && modeOf(r).mode !== 'blocked')
  const out: Record<Fit, Ex[]> = { ok: [], care: [], avoid: [] }
  CATALOG.forEach(e => {
    let f: Fit = 'ok'
    act.forEach(r => {
      const x = fitFor(e.z, r)
      if (x === 'avoid' || (x === 'care' && f === 'ok')) f = x
    })
    out[f].push(e)
  })
  return out
}