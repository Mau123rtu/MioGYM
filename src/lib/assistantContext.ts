import { supabase } from './supabase'
import type { Profile } from '../context/AuthContext'
import { calcAge, calcBMI } from './utils'
import { planProgress, type Plan } from './routine'
import { MIN_DAYS } from './progress'
import { ZONE_LABEL, modeOf, summarize, type Report } from './injury'
import { KINDS, analyzeItem, type SuppItem } from './suppDb'
import type { NPlan } from './nutritionPlan'
import type { Answers } from './questionnaires'

export interface Alert { kind: 'ok' | 'tip' | 'warn'; text: string; to?: string; cta?: string }
export interface Built {
  ctx: Record<string, unknown>
  alerts: Alert[]
  flags: { injury: boolean; supplements: boolean; plan: boolean }
}

const DAY = 86400000
const keyOf = (d: Date) => d.toLocaleDateString('en-CA')
const part = (n: string) => n.split(' · ').slice(1).join(' · ') || n
const r1 = (x: number) => Math.round(x * 10) / 10

export async function buildContext(profile: Profile): Promise<Built> {
  const now = new Date()
  const s0 = new Date(now); s0.setHours(0, 0, 0, 0)
  const iso = (ms: number) => new Date(ms).toISOString()

  const [mp, inj, rt, ses, food, np, sl, si, wl, bm, rem, mrem, lg] = await Promise.all([
    supabase.from('module_profiles').select('module,answers'),
    supabase.from('injury_reports').select('*').eq('status', 'active'),
    supabase.from('routines').select('plan').maybeSingle(),
    supabase.from('workout_sessions').select('completed_at,day_name,duration_sec').gte('completed_at', iso(Date.now() - 30 * DAY)).order('completed_at', { ascending: false }).limit(60),
    supabase.from('food_logs').select('meal,description,calories,protein_g,logged_at').gte('logged_at', s0.toISOString()).order('logged_at', { ascending: true }),
    supabase.from('nutrition_plans').select('plan').maybeSingle(),
    supabase.from('supplement_logs').select('name,kind,caffeine_mg,servings,timing,taken_at').gte('taken_at', s0.toISOString()).order('taken_at', { ascending: true }),
    supabase.from('supplement_items').select('*').limit(30),
    supabase.from('weight_logs').select('weight_kg,logged_at').gte('logged_at', iso(Date.now() - 60 * DAY)).order('logged_at', { ascending: true }),
    supabase.from('body_measurements').select('*').order('measured_at', { ascending: false }).limit(2),
    supabase.from('reminders').select('type,enabled,time_of_day,interval_minutes'),
    supabase.from('meal_reminders').select('label,time_of_day').eq('enabled', true),
    supabase.from('workout_logs').select('exercise,weight_kg,reps,logged_at').gte('logged_at', iso(Date.now() - 21 * DAY)).order('logged_at', { ascending: false }).limit(200),
  ])

  const ans = (m: string) => (mp.data?.find(d => d.module === m)?.answers ?? {}) as Answers
  const nut = ans('nutricion'), sup = ans('suplementos'), les = ans('lesiones'), rut = ans('rutinas')
  const hour = now.getHours()
  const age = calcAge(profile.birth_date)
  const bmi = calcBMI(profile.weight_kg, profile.height_cm)
  const weight = Number(profile.weight_kg) || 70
  const alerts: Alert[] = []

  /* ---- Prevención ---- */
  const reports = (inj.data ?? []) as Report[]
  const sum = summarize(reports)
  const prevention = {
    estado: sum.mode === 'blocked' ? 'bloqueado' : sum.mode === 'adjust' ? 'con ajustes' : sum.mode === 'ok' ? 'con precauciones' : 'sin molestias',
    molestias: reports.map(r => ({
      zona: ZONE_LABEL[r.zone] ?? r.zone, parte: r.part, lado: r.side, dolor_0_a_10: r.pain, nivel: r.level,
      modo: modeOf(r).mode, autorizacion_medica: r.override?.type === 'doctor', falsa_alarma: r.override?.type === 'false_alarm',
    })),
    ajustes: sum.mode === 'adjust' ? { carga_porcentaje: Math.round(sum.loadFactor * 100), descanso_extra_seg: sum.restBonus } : null,
    cuestionario: { dolor: les.dolor ?? null, calentamiento: les.calentamiento ?? null, quiere_mejorar: les.mejorar ?? null },
  }
  const zonas = sum.zones.map(z => (ZONE_LABEL[z] ?? z).toLowerCase()).join(', ')
  if (sum.mode === 'blocked') alerts.push({ kind: 'warn', text: 'Tus rutinas están bloqueadas por tu molestia. Hoy toca descansar y seguir las indicaciones de Prevención.', to: '/app/lesiones', cta: 'Ver mi estado' })
  else if (sum.mode === 'adjust') alerts.push({ kind: 'tip', text: `Entrenas con ajustes por tu ${zonas}: usa cerca del ${Math.round(sum.loadFactor * 100)}% de tu carga, descansa ${sum.restBonus} s más y para si el dolor pasa de 3/10.`, to: '/app/lesiones', cta: 'Ver ejercicios' })

  /* ---- Entrenamiento ---- */
  const plan = rt.data?.plan as Plan | undefined
  const pr = plan && plan.days.length > 0 ? planProgress(plan) : null
  const todayDay = pr?.days[pr.todayIdx]
  const sessions = (ses.data ?? []) as { completed_at: string; day_name: string; duration_sec: number | null }[]
  const tk = keyOf(now)
  const trainedToday = sessions.some(s => keyOf(new Date(s.completed_at)) === tk)
  const mon = new Date(s0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
  const weekDays = new Set(sessions.filter(s => new Date(s.completed_at) >= mon).map(s => keyOf(new Date(s.completed_at)))).size
  const target = MIN_DAYS[profile.days_per_week ?? '3-4'] ?? 3
  const last = sessions[0]
  const since = last ? Math.floor((s0.getTime() - new Date(new Date(last.completed_at).setHours(0, 0, 0, 0)).getTime()) / DAY) : null
  const trainDay = trainedToday || (!!todayDay && !todayDay.rest)

  const loads = new Map<string, { kg: number; reps: number | null; fecha: string }>()
  ;((lg.data ?? []) as { exercise: string; weight_kg: number; reps: number | null; logged_at: string }[]).forEach(l => {
    if (Number(l.weight_kg) > 0 && !loads.has(l.exercise)) loads.set(l.exercise, { kg: Number(l.weight_kg), reps: l.reps, fecha: l.logged_at.slice(0, 10) })
  })

  const training = {
    entreno_hoy: trainedToday ? 'ya entrenó hoy' : pr ? (todayDay?.rest ? 'hoy es día de descanso' : `hoy toca: ${part(todayDay!.name)}`) : 'sin rutina creada',
    ejercicios_de_hoy: todayDay && !todayDay.rest ? todayDay.exercises.map(e => `${e.name} ${e.sets}x${e.reps}`).slice(0, 10) : [],
    semana_del_ciclo: pr ? `${pr.weekNumber} de ${pr.total}` : null,
    entrenos_esta_semana: weekDays, meta_semanal: target,
    dias_desde_el_ultimo_entreno: since,
    ultimos_entrenos: sessions.slice(0, 6).map(s => ({ fecha: s.completed_at.slice(0, 10), rutina: part(s.day_name), min: s.duration_sec ? Math.round(s.duration_sec / 60) : null })),
    ultimas_cargas: [...loads.entries()].slice(0, 8).map(([ejercicio, v]) => ({ ejercicio, ...v })),
    cuestionario: { tipo: rut.tipo ?? null, grupos_prioritarios: rut.grupos ?? null, equipo: rut.equipo ?? null, recuperacion: rut.recuperacion ?? null },
  }
  if (sum.mode !== 'blocked') {
    if (trainedToday) alerts.push({ kind: 'ok', text: 'Hoy ya entrenaste. Come proteína, hidrátate y deja descansar esos músculos unas 48 horas.' })
    else if (!pr) alerts.push({ kind: 'tip', text: 'Aún no tienes rutina. Completa tu perfil de rutinas y armamos tu semana.', to: '/app/ejercicios/perfil', cta: 'Crear rutina' })
    else if (todayDay && !todayDay.rest) alerts.push({ kind: 'tip', text: `Hoy toca ${part(todayDay.name)}. Calienta unos 5 minutos y anota tus cargas.`, to: '/app/ejercicios', cta: 'Ver rutina' })
    else alerts.push({ kind: 'ok', text: 'Hoy es día de descanso: es cuando el cuerpo se recupera. Camina un poco, estira y duerme bien.' })
    if (since !== null && since >= 7) alerts.push({ kind: 'tip', text: `Llevas ${since} días sin entrenar. Una sesión corta de 20 a 30 minutos ya cuenta, y al volver baja tus cargas un 10 a 20%.`, to: '/app/ejercicios', cta: 'Ir a rutinas' })
  }

  /* ---- Nutrición ---- */
  const nplan = np.data?.plan as NPlan | undefined
  const foods = (food.data ?? []) as { meal: string; description: string; calories: number | null; protein_g: number | null; logged_at: string }[]
  const eatK = foods.reduce((a, f) => a + (f.calories ?? 0), 0)
  const eatP = Math.round(foods.reduce((a, f) => a + Number(f.protein_g ?? 0), 0))
  const liters = r1(weight * 0.035 + (trainDay ? 0.5 : 0))
  const habitual = ({ '<1': 0.75, '1-2': 1.5, '2-3': 2.5, '>3': 3.5 } as Record<string, number>)[String(nut.agua)]
  const waterRem = ((rem.data ?? []) as { type: string; enabled: boolean }[]).find(r => r.type === 'water')

  const nutrition = {
    etapa: nplan?.phase ?? null,
    meta_diaria: nplan ? { kcal: nplan.kcal, proteina_g: nplan.p, carbohidratos_g: nplan.c, grasa_g: nplan.fat } : null,
    comido_hoy: { kcal: eatK, proteina_g: eatP, comidas: foods.map(f => ({ hora: f.logged_at.slice(11, 16) === '' ? '' : new Date(f.logged_at).toTimeString().slice(0, 5), tipo: f.meal, plato: f.description.slice(0, 60), kcal: f.calories })) },
    agua_habitual_declarada: nut.agua ?? null,
    agua_orientativa_litros: liters,
    recordatorio_de_agua: waterRem?.enabled ? 'activo' : 'apagado',
    recordatorios_de_comida: ((mrem.data ?? []) as { label: string; time_of_day: string }[]).map(m => `${m.label} ${m.time_of_day.slice(0, 5)}`),
    cuestionario: {
      objetivo: nut.objetivo ?? null, alimentacion: nut.alimentacion ?? null, comidas_al_dia: nut.comidas ?? null, tipo_de_dieta: nut.dieta ?? null,
      alergias: nut.alergias === 'si' ? { tipo: nut.alergias_tipo, detalle: String(nut.alergias_detalle ?? '').slice(0, 80) } : nut.alergias ?? null,
      condicion_o_indicacion_profesional: nut.condicion ?? null, tiempo_para_cocinar: nut.tiempo ?? null,
    },
  }
  if (nplan) {
    if (hour >= 17 && eatP < nplan.p * 0.6) alerts.push({ kind: 'tip', text: `Llevas ${eatP} g de proteína de ${nplan.p} g. Te faltan unos ${nplan.p - eatP} g: huevo, pollo, pescado, yogur griego, frijoles o tofu te ayudan a llegar.`, to: '/app/nutricion', cta: 'Anotar comida' })
    if (hour >= 20 && eatK < nplan.kcal * 0.6) alerts.push({ kind: 'tip', text: `Llevas ${eatK} kcal de unas ${nplan.kcal}. Si no anotaste todo, regístralo; si de verdad comiste poco, una cena completa te ayudará.`, to: '/app/nutricion', cta: 'Ver plan' })
    if (eatK > nplan.kcal * 1.15) alerts.push({ kind: 'tip', text: `Ya pasaste tu meta de ${nplan.kcal} kcal (${eatK}). No pasa nada por un día: mañana vuelve a tu plan.` })
  } else {
    alerts.push({ kind: 'tip', text: 'Aún no tienes plan de comida. Crea tus recomendaciones para saber cuánta proteína y calorías te tocan.', to: '/app/nutricion', cta: 'Crear plan' })
  }
  if (hour >= 13 && foods.length === 0) alerts.push({ kind: 'tip', text: 'Todavía no anotaste ninguna comida hoy. Registrar lo que comes te ayuda a ver qué te falta.', to: '/app/nutricion', cta: 'Anotar' })

  alerts.push({ kind: 'tip', text: `Agua: como referencia, unos ${liters} L hoy (≈35 ml por kg${trainDay ? ', más un extra por entrenar' : ''}). Es una estimación; sube si hace calor o sudas mucho.` })
  if (habitual !== undefined && habitual < liters - 0.5) alerts.push({ kind: 'tip', text: `Dijiste que bebes unos ${habitual} L al día y tu referencia es de ${liters} L. Ve subiendo poco a poco y toma agua durante el entreno.` })
  if (!waterRem?.enabled) alerts.push({ kind: 'tip', text: 'Activa el recordatorio de agua para no olvidarlo.', to: '/app/mas/cuenta', cta: 'Activar' })

  /* ---- Suplementos ---- */
  const sctx = { age, medication: sup.medicacion === 'si' }
  const items = (si.data ?? []) as SuppItem[]
  const takes = (sl.data ?? []) as { name: string; kind: string; caffeine_mg: number | null; servings: number; timing: string; taken_at: string }[]
  const caff = Math.round(takes.reduce((a, t) => a + Number(t.caffeine_mg ?? 0) * Number(t.servings ?? 1), 0))
  const limit = age !== null && age < 18 ? 100 : 400
  const analyzed = items.map(it => {
    const an = analyzeItem(it, sctx)
    return { nombre: it.name, tipo: KINDS[it.kind]?.label ?? it.kind, valoracion: an.verdict, avisos: an.flags.filter(f => f.level !== 'info').slice(0, 3).map(f => f.text) }
  })
  const supplements = {
    toma_medicamentos_o_indicacion_medica: sctx.medication,
    mis_suplementos: analyzed,
    tomas_de_hoy: takes.map(t => ({ nombre: t.name, momento: t.timing, hora: new Date(t.taken_at).toTimeString().slice(0, 5), cafeina_mg: Math.round(Number(t.caffeine_mg ?? 0) * Number(t.servings ?? 1)) })),
    cafeina_total_hoy_mg: caff, limite_cafeina_mg: limit,
    cuestionario: { objetivo: sup.objetivo ?? null, presupuesto: sup.presupuesto ?? null, restricciones: sup.restricciones ?? null },
  }
  if (caff > limit) alerts.push({ kind: 'warn', text: `Llevas ${caff} mg de cafeína hoy, por encima del límite de ${limit} mg. Evita más cafeína hoy.`, to: '/app/suplementos', cta: 'Ver suplementos' })
  else if (takes.some(t => Number(t.caffeine_mg) > 0 && new Date(t.taken_at).getHours() >= 16)) alerts.push({ kind: 'warn', text: 'Tomaste cafeína después de las 4 pm: puede afectar tu sueño y tu recuperación.' })
  analyzed.filter(a => a.valoracion === 'avoid').forEach(a => alerts.push({ kind: 'warn', text: `Tu suplemento "${a.nombre}" salió como "mejor evitarlo". Revisa su análisis.`, to: '/app/suplementos', cta: 'Revisar' }))

  /* ---- Cuerpo ---- */
  const w = (wl.data ?? []) as { weight_kg: number; logged_at: string }[]
  const lw = w[w.length - 1]
  const wDays = lw ? Math.floor((s0.getTime() - new Date(new Date(lw.logged_at).setHours(0, 0, 0, 0)).getTime()) / DAY) : null
  if (wDays === null || wDays > 14) alerts.push({ kind: 'tip', text: wDays === null ? 'Aún no registras tu peso. Anótalo para ver tu progreso.' : `Tu último peso fue hace ${wDays} días. Pésate cada 1 o 2 semanas en condiciones parecidas.`, to: '/app/mas/cuenta', cta: 'Registrar' })

  const ctx = {
    hoy: now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }), hora_actual: now.toTimeString().slice(0, 5),
    perfil: {
      edad: age, sexo: profile.sex, peso_kg: profile.weight_kg, altura_cm: profile.height_cm, imc: bmi ? `${bmi.value} (${bmi.label})` : null,
      objetivo: profile.goal, experiencia: profile.experience, dias_por_semana: profile.days_per_week, lugar_de_entreno: profile.training_place,
    },
    prevencion: prevention, entrenamiento: training, nutricion: nutrition, suplementos: supplements,
    peso_ultimos_60_dias: w.length > 1 ? { primero: Number(w[0].weight_kg), ultimo: Number(lw.weight_kg), cambio_kg: r1(Number(lw.weight_kg) - Number(w[0].weight_kg)) } : null,
    ultimas_medidas_cm: (bm.data ?? []).map((m: Record<string, unknown>) => ({ fecha: m.measured_at, brazo: m.arm_cm, pierna: m.thigh_cm, cintura: m.waist_cm, cadera: m.hip_cm, pecho: m.chest_cm })),
    avisos_calculados_por_la_app: alerts.map(a => a.text),
  }
  return { ctx, alerts, flags: { injury: reports.length > 0, supplements: items.length > 0, plan: !!pr } }
}