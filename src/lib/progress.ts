import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface WLog { weight_kg: number; logged_at: string }
export interface MRow { id: number; measured_at: string; arm_cm: number | null; thigh_cm: number | null; waist_cm: number | null; hip_cm: number | null; chest_cm: number | null }
export interface SLog { completed_at: string }
export interface XLog { exercise: string; weight_kg: number; logged_at: string }
export interface PData { weights: WLog[]; meas: MRow[]; sess: SLog[]; logs: XLog[]; loading: boolean }
export interface Tip { kind: 'ok' | 'tip' | 'warn'; text: string }

export const MFIELDS = [
  ['arm_cm', 'Brazo'], ['thigh_cm', 'Pierna'], ['waist_cm', 'Cintura'], ['hip_cm', 'Cadera'], ['chest_cm', 'Pecho'],
] as const
export type MKey = (typeof MFIELDS)[number][0]
export const MIN_DAYS: Record<string, number> = { '1-2': 1, '3-4': 3, '5-6': 5, '7': 7 }

const DAY = 86400000
export const progressChanged = () => window.dispatchEvent(new Event('progress-changed'))
const at = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00` : s).getTime()

export function useProgressData(): PData & { reload: () => void } {
  const [d, setD] = useState<PData>({ weights: [], meas: [], sess: [], logs: [], loading: true })
  const load = useCallback(async () => {
    const [w, m, s, l] = await Promise.all([
      supabase.from('weight_logs').select('weight_kg,logged_at').order('logged_at', { ascending: true }),
      supabase.from('body_measurements').select('*').order('measured_at', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('workout_sessions').select('completed_at').order('completed_at', { ascending: true }).limit(2000),
      supabase.from('workout_logs').select('exercise,weight_kg,logged_at').order('logged_at', { ascending: true }).limit(5000),
    ])
    setD({
      weights: (w.data as WLog[]) ?? [], meas: (m.data as MRow[]) ?? [],
      sess: (s.data as SLog[]) ?? [], logs: (l.data as XLog[]) ?? [], loading: false,
    })
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('progress-changed', load)
    return () => window.removeEventListener('progress-changed', load)
  }, [load])
  return { ...d, reload: load }
}

/** Último peso registrado hasta el final del día t */
export const weightAt = (d: PData, t: number) =>
  [...d.weights].filter(x => at(x.logged_at) <= t + DAY - 1).pop()?.weight_kg ?? null

export function periodStats(d: PData, start: Date, end: Date) {
  const s = start.getTime(), e = end.getTime()
  const days = Math.max(1, Math.round((e - s) / DAY) + 1)
  const w0 = d.weights.filter(x => at(x.logged_at) <= s + DAY - 1).pop() ?? d.weights.find(x => at(x.logged_at) >= s)
  const w1 = d.weights.filter(x => at(x.logged_at) <= e + DAY - 1).pop()
  const weightDelta = w0 && w1 && w0 !== w1 ? Number(w1.weight_kg) - Number(w0.weight_kg) : null

  const deltas: Partial<Record<MKey, number>> = {}
  MFIELDS.forEach(([k]) => {
    const rows = d.meas.filter(r => r[k] !== null)
    const m0 = rows.filter(r => at(r.measured_at) <= s + DAY - 1).pop() ?? rows.find(r => at(r.measured_at) >= s)
    const m1 = rows.filter(r => at(r.measured_at) <= e + DAY - 1).pop()
    if (m0 && m1 && m0 !== m1) deltas[k] = Number(m1[k]) - Number(m0[k])
  })

  const sd = new Set(d.sess.filter(x => at(x.completed_at) >= s && at(x.completed_at) <= e + DAY - 1).map(x => new Date(x.completed_at).toDateString()))
  const byEx = new Map<string, number[]>()
  d.logs.filter(x => Number(x.weight_kg) > 0 && at(x.logged_at) >= s && at(x.logged_at) <= e + DAY - 1)
    .forEach(x => byEx.set(x.exercise, [...(byEx.get(x.exercise) ?? []), Number(x.weight_kg)]))
  let up = 0, down = 0
  byEx.forEach(v => { if (v.length > 1) { if (v[v.length - 1] > v[0]) up++; else if (v[v.length - 1] < v[0]) down++ } })

  return { days, weeks: days / 7, weightDelta, deltas, sessions: sd.size, perWeek: sd.size / (days / 7), up, down }
}
export type Stats = ReturnType<typeof periodStats>

const r1 = (x: number) => Math.round(x * 10) / 10

export function feedback(o: { goal: string | null; target: number; st: Stats; weightKg: number; age: number | null }): Tip[] {
  const { goal, target, st, weightKg, age } = o
  const t: Tip[] = []
  const noData = st.weightDelta === null && Object.keys(st.deltas).length === 0 && st.sessions === 0
  if (noData) return [{ kind: 'tip', text: 'Todavía no hay datos en este periodo. Registra tu peso, tus medidas y tus entrenos para poder comparar.' }]

  if (st.days < 14) t.push({ kind: 'tip', text: `Es un periodo corto (${st.days} días). Los cambios del cuerpo suelen notarse mejor después de 4 semanas o más; no te desanimes si aún no ves nada.` })

  // Constancia
  const ratio = st.perWeek / target
  if (st.sessions === 0) t.push({ kind: 'warn', text: 'No registraste entrenos completos en este periodo. Sin constancia es difícil ver cambios; empieza por cumplir tus días de la semana.' })
  else if (ratio >= 0.8) t.push({ kind: 'ok', text: `Vas constante: ${st.sessions} entrenos (${r1(st.perWeek)} por semana, tu meta es ${target}). Tu rutina está funcionando a nivel de hábito.` })
  else if (ratio >= 0.5) t.push({ kind: 'tip', text: `Entrenaste ${r1(st.perWeek)} veces por semana y tu meta es ${target}. Vas bien, pero ser un poco más constante acelerará el progreso.` })
  else t.push({ kind: 'warn', text: `Entrenaste ${r1(st.perWeek)} veces por semana frente a tu meta de ${target}. Si no te alcanza el tiempo, mejor baja la meta a algo que sí puedas cumplir.` })

  // Fuerza
  if (st.up > 0) t.push({ kind: 'ok', text: `Subiste la carga en ${st.up} ejercicio${st.up === 1 ? '' : 's'}: es una señal clara de progreso.` })
  if (st.down > 0 && st.down > st.up) t.push({ kind: 'tip', text: `Tus cargas bajaron en ${st.down} ejercicio${st.down === 1 ? '' : 's'}. Puede ser fatiga, poco descanso o poca comida; revisa tu sueño y tu recuperación.` })

  // Peso según objetivo
  const dw = st.weightDelta
  const pct = dw !== null ? (dw / st.weeks / weightKg) * 100 : null
  const minor = age !== null && age < 18
  if (dw !== null && pct !== null) {
    const txt = `${dw > 0 ? 'subió' : dw < 0 ? 'bajó' : 'se mantuvo'} ${Math.abs(r1(dw))} kg`
    if (goal === 'grasa' && minor) t.push({ kind: 'tip', text: `Tu peso ${txt}. Al ser menor de edad, no buscamos bajar de peso; consulta con un profesional de salud.` })
    else if (goal === 'grasa') {
      if (pct < -1) t.push({ kind: 'warn', text: `Tu peso ${txt}, un ritmo rápido (más de 1% por semana). Bajar tan rápido puede costarte músculo y energía; considera comer un poco más.` })
      else if (dw < -0.1) t.push({ kind: 'ok', text: `Tu peso ${txt}, a un ritmo razonable para perder grasa.` })
      else t.push({ kind: 'tip', text: `Tu peso ${txt}. Si buscas perder grasa y no baja, revisa tus porciones y tu constancia. Mira también tu cintura: puede bajar aunque la báscula no se mueva.` })
    } else if (goal === 'masa') {
      if (dw > 0 && pct <= 0.5) t.push({ kind: 'ok', text: `Tu peso ${txt}, un ritmo adecuado para ganar masa con poca grasa.` })
      else if (dw > 0) t.push({ kind: 'tip', text: `Tu peso ${txt}, algo rápido. Una parte probablemente sea grasa; puedes bajar un poco las calorías.` })
      else t.push({ kind: 'tip', text: `Tu peso ${txt}. Para ganar masa normalmente hace falta subir poco a poco: considera comer algo más y mantener tu proteína.` })
    } else if (Math.abs(pct) <= 0.5) t.push({ kind: 'ok', text: `Tu peso ${txt}: estable.` })
    else t.push({ kind: 'tip', text: `Tu peso ${txt}. Si no era tu intención, revisa tu alimentación y tu actividad.` })
  }

  // Medidas
  const d = st.deltas
  const fmt = (k: MKey) => `${d[k]! > 0 ? '+' : ''}${r1(d[k]!)} cm`
  if (d.waist_cm !== undefined) {
    if (goal === 'grasa' && d.waist_cm < -0.5) t.push({ kind: 'ok', text: `Tu cintura cambió ${fmt('waist_cm')}: va en la dirección que buscas.` })
    else if (d.waist_cm > 2 && (goal === 'grasa' || goal === 'saludable' || goal === 'condicion')) t.push({ kind: 'tip', text: `Tu cintura cambió ${fmt('waist_cm')}. Si tu objetivo es perder grasa o mejorar tu salud, vale la pena revisar tu alimentación.` })
    else if (goal === 'masa' && d.waist_cm > 3) t.push({ kind: 'tip', text: `Tu cintura cambió ${fmt('waist_cm')}, más que tus músculos. Considera un superávit un poco menor.` })
  }
  const grew = (['arm_cm', 'chest_cm', 'thigh_cm'] as MKey[]).filter(k => (d[k] ?? 0) >= 0.5)
  if (goal === 'masa' && grew.length) t.push({ kind: 'ok', text: `Creció ${grew.map(k => MFIELDS.find(f => f[0] === k)![1].toLowerCase()).join(', ')}: buena señal de ganancia muscular.` })

  t.push({ kind: 'tip', text: 'Las fotos y las medidas cuentan lo que ves tú; la app no evalúa tu cuerpo en una imagen. Compara siempre con la misma luz, ropa y pose.' })
  return t
}