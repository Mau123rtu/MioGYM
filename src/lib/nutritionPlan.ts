import type { Profile } from '../context/AuthContext'
import type { Answers } from './questionnaires'
import { calcAge } from './utils'

export type Phase = 'volumen' | 'definicion' | 'deficit' | 'mantener'
export interface Opt { n: string; mult: number; kcal: number; p: number; c: number; fat: number }
export interface PlanMeal { k: string; slot: string; label: string; time: string; target: number; options: Opt[] }
export interface NPlan {
  phase: Phase; tdee: number; kcal: number; p: number; c: number; fat: number
  meals: PlanMeal[]; tips: string[]; warnings: string[]; weight: number; seed: number; createdAt: string
}

export const PHASES: Record<Phase, { label: string; desc: string; adj: number; prot: number; restrictive: boolean }> = {
  volumen: { label: 'Volumen', desc: 'Superávit calórico leve para ganar masa muscular con poca grasa.', adj: 0.10, prot: 1.8, restrictive: false },
  definicion: { label: 'Definición', desc: 'Déficit moderado y proteína alta para perder grasa conservando músculo.', adj: -0.15, prot: 2.2, restrictive: true },
  deficit: { label: 'Déficit calórico', desc: 'Déficit para bajar de peso de forma gradual.', adj: -0.20, prot: 2.0, restrictive: true },
  mantener: { label: 'Mantenimiento', desc: 'Comer lo que gastas para mantener tu peso y rendir.', adj: 0, prot: 1.6, restrictive: false },
}

interface Food { n: string; slot: 'desayuno' | 'comida' | 'cena' | 'colacion'; kcal: number; p: number; c: number; fat: number; diet: 0 | 1 | 2; al: string[] }
// diet: 0 = con carne o pescado, 1 = vegetariana, 2 = vegana
const F = (n: string, slot: Food['slot'], kcal: number, p: number, c: number, fat: number, diet: 0 | 1 | 2, al = ''): Food =>
  ({ n, slot, kcal, p, c, fat, diet, al: al ? al.split(',') : [] })

const FOODS: Food[] = [
  F('Omelette de 3 huevos con espinacas y 2 tortillas de maíz', 'desayuno', 480, 27, 36, 24, 1, 'huevo'),
  F('Avena con leche, plátano y crema de cacahuate', 'desayuno', 450, 20, 62, 13, 1, 'lacteos,frutos_secos'),
  F('Yogur griego con fruta y granola', 'desayuno', 380, 24, 50, 9, 1, 'lacteos,gluten'),
  F('Huevos a la mexicana con frijoles y 2 tortillas', 'desayuno', 520, 28, 52, 20, 1, 'huevo'),
  F('Avena con bebida de soya, fruta y semillas', 'desayuno', 400, 18, 58, 11, 2, 'soya'),
  F('2 tostadas integrales con aguacate y 2 huevos cocidos', 'desayuno', 420, 22, 32, 22, 1, 'huevo,gluten'),
  F('Tofu revuelto con verduras y 2 tortillas', 'desayuno', 400, 26, 38, 16, 2, 'soya'),

  F('Pechuga de pollo (150 g) a la plancha, 1 taza de arroz y ensalada', 'comida', 560, 48, 60, 12, 0),
  F('Bistec de res magro (150 g) con frijoles y arroz', 'comida', 620, 46, 62, 18, 0),
  F('3 tacos de pescado con repollo', 'comida', 520, 38, 50, 16, 0, 'pescado'),
  F('Lentejas guisadas con arroz y verduras', 'comida', 520, 26, 85, 8, 2),
  F('Pasta integral con atún y verduras', 'comida', 540, 38, 66, 12, 0, 'pescado,gluten'),
  F('Bowl de quinoa, garbanzos, aguacate y verduras', 'comida', 560, 22, 70, 20, 2),
  F('3 tacos de pollo deshebrado con frijoles', 'comida', 560, 42, 58, 16, 0),
  F('3 quesadillas de queso panela con nopales', 'comida', 520, 30, 40, 26, 1, 'lacteos'),

  F('Pescado (150 g) al horno con verduras y papa', 'cena', 480, 38, 38, 18, 0, 'pescado'),
  F('Ensalada con pollo, aguacate y 1 tortilla', 'cena', 430, 38, 22, 20, 0),
  F('Tortilla de 3 huevos con verduras y frijoles', 'cena', 430, 28, 28, 22, 1, 'huevo'),
  F('Curry de garbanzo con arroz', 'cena', 470, 18, 70, 12, 2),
  F('Tofu salteado con verduras y arroz', 'cena', 450, 26, 52, 14, 2, 'soya'),
  F('Pavo (150 g) en tiras con camote', 'cena', 440, 40, 42, 9, 0),

  F('Yogur griego con fruta', 'colacion', 180, 17, 20, 3, 1, 'lacteos'),
  F('Manzana con 2 cucharadas de crema de cacahuate', 'colacion', 250, 7, 28, 13, 2, 'frutos_secos'),
  F('2 huevos cocidos y una fruta', 'colacion', 230, 14, 20, 10, 1, 'huevo'),
  F('Un puñado de nueces (30 g) y una fruta', 'colacion', 260, 6, 22, 17, 2, 'frutos_secos'),
  F('Licuado de proteína con plátano', 'colacion', 250, 26, 28, 3, 1, 'lacteos'),
  F('Hummus con verduras y totopos', 'colacion', 220, 8, 26, 10, 2),
  F('Atún con galletas integrales', 'colacion', 200, 22, 16, 5, 0, 'pescado,gluten'),
]

const AL_WORDS: Record<string, string[]> = {
  huevo: ['huevo'],
  lacteos: ['lacteo', 'leche', 'queso', 'yogur', 'lactosa', 'crema'],
  gluten: ['gluten', 'trigo', 'celiaq', 'avena'],
  frutos_secos: ['nuez', 'nueces', 'almendra', 'cacahuate', 'mani', 'frutos secos'],
  pescado: ['pescado', 'atun', 'marisco', 'camaron', 'salmon'],
  soya: ['soya', 'soja', 'tofu'],
}
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const SLOTS: Record<string, { k: string; slot: Food['slot']; label: string; time: string; pct: number }[]> = {
  '3': [
    { k: 'd', slot: 'desayuno', label: 'Desayuno', time: '08:00', pct: 0.30 },
    { k: 'c', slot: 'comida', label: 'Comida', time: '14:00', pct: 0.40 },
    { k: 'n', slot: 'cena', label: 'Cena', time: '20:00', pct: 0.30 },
  ],
  '4': [
    { k: 'd', slot: 'desayuno', label: 'Desayuno', time: '08:00', pct: 0.25 },
    { k: 'c', slot: 'comida', label: 'Comida', time: '14:00', pct: 0.35 },
    { k: 'x', slot: 'colacion', label: 'Colación', time: '17:00', pct: 0.10 },
    { k: 'n', slot: 'cena', label: 'Cena', time: '20:00', pct: 0.30 },
  ],
  '5': [
    { k: 'd', slot: 'desayuno', label: 'Desayuno', time: '08:00', pct: 0.25 },
    { k: 'x1', slot: 'colacion', label: 'Colación de la mañana', time: '11:00', pct: 0.10 },
    { k: 'c', slot: 'comida', label: 'Comida', time: '14:00', pct: 0.30 },
    { k: 'x2', slot: 'colacion', label: 'Colación de la tarde', time: '17:00', pct: 0.10 },
    { k: 'n', slot: 'cena', label: 'Cena', time: '20:00', pct: 0.25 },
  ],
}

export function computeTargets(p: Profile, phase: Phase) {
  const w = Number(p.weight_kg), h = Number(p.height_cm), age = calcAge(p.birth_date)
  if (!w || !h || age === null) return null
  const base = 10 * w + 6.25 * h - 5 * age
  const bmr = p.sex === 'mujer' ? base - 161 : p.sex === 'hombre' ? base + 5 : base - 78
  const af = ({ '1-2': 1.35, '3-4': 1.5, '5-6': 1.65, '7': 1.7 } as Record<string, number>)[p.days_per_week ?? '3-4'] ?? 1.5
  const tdee = bmr * af
  const info = PHASES[phase]
  let kcal = tdee * (1 + info.adj)
  const floor = p.sex === 'mujer' ? 1200 : 1500
  const clamped = info.restrictive && kcal < floor
  if (clamped) kcal = floor

  const hm = h / 100
  const refW = w / (hm * hm) > 30 ? 27 * hm * hm : w   // con IMC alto, la proteína se calcula sobre un peso de referencia
  const prot = Math.round(info.prot * refW)
  const fat = Math.round(Math.max(0.8 * refW, (kcal * 0.2) / 9))
  const carbs = Math.max(50, Math.round((kcal - prot * 4 - fat * 9) / 4))
  return { w, tdee: Math.round(tdee / 10) * 10, kcal: Math.round(kcal / 10) * 10, p: prot, c: carbs, fat, clamped, refW }
}

export function buildPlan(o: { profile: Profile; a: Answers; phase: Phase; seed: number }): NPlan | null {
  const { profile, a, phase, seed } = o
  const t = computeTargets(profile, phase)
  if (!t) return null
  const age = calcAge(profile.birth_date) ?? 30
  const warnings: string[] = []

  if (!profile.sex) warnings.push('No indicaste tu sexo en Más → Cuenta, así que usamos un promedio. Elígelo para afinar el cálculo.')
  if (t.clamped) warnings.push('Ajustamos tus calorías al mínimo que recomendamos para no quedarte demasiado bajo.')
  if (age < 18) warnings.push('Eres menor de edad: estas cifras son una referencia general. Consulta con un profesional de salud o nutrición.')
  if (a.condicion === 'si') warnings.push('Indicaste una condición o indicación profesional: esa indicación manda sobre estas sugerencias.')
  if (a.dieta === 'otra') warnings.push('Indicaste otra preferencia alimentaria: revisa cada opción, porque puede no ajustarse.')

  // Dieta
  const maxDiet = a.dieta === 'vegana' ? 2 : a.dieta === 'vegetariana' ? 1 : 0
  const okDiet = (f: Food) => (maxDiet === 0 ? true : f.diet >= maxDiet)

  // Alergias: se excluyen alimentos que coincidan con lo que escribió
  const blocked = new Set<string>()
  if (a.alergias === 'si') {
    const txt = norm(String(a.alergias_detalle ?? ''))
    Object.entries(AL_WORDS).forEach(([tag, words]) => { if (words.some(w => txt.includes(w))) blocked.add(tag) })
    warnings.push(`Evitamos ${blocked.size ? Array.from(blocked).join(', ').replace('_', ' ') : 'los alimentos que indicaste'} según lo que escribiste. Aun así, revisa siempre ingredientes y etiquetas.`)
  } else if (a.alergias === 'nose') {
    warnings.push('Dijiste que no estás seguro de tus alergias: revisa los ingredientes de cada opción.')
  }

  const slots = SLOTS[({ '1-2': '3', '3': '3', '4': '4', '5+': '5', variable: '4' } as Record<string, string>)[a.comidas] ?? '4']
  if (a.comidas === '1-2') warnings.push('Dijiste que haces 1 o 2 comidas: te proponemos 3 para repartir mejor tu proteína. Ajústalo a tu rutina.')

  const meals: PlanMeal[] = slots.map((s, i) => {
    const target = Math.round(t.kcal * s.pct)
    const pool = FOODS.filter(f => f.slot === s.slot && okDiet(f) && !f.al.some(x => blocked.has(x)))
    const options: Opt[] = []
    if (pool.length) {
      const start = (seed * 2 + i) % pool.length
      const picks = pool.length > 1 ? [pool[start], pool[(start + 1) % pool.length]] : [pool[start]]
      picks.forEach(f => {
        const m = Math.min(2, Math.max(0.5, Math.round((target / f.kcal) * 4) / 4))
        options.push({ n: f.n, mult: m, kcal: Math.round(f.kcal * m), p: Math.round(f.p * m), c: Math.round(f.c * m), fat: Math.round(f.fat * m) })
      })
    }
    return { k: s.k, slot: s.slot, label: s.label, time: s.time, target, options }
  })

  const w = t.w
  const r = (x: number) => Math.round(x * 10) / 10
  const rate: Record<Phase, string> = {
    volumen: `Apunta a subir entre ${r(w * 0.0025)} y ${r(w * 0.005)} kg por semana. Subir más rápido suele sumar más grasa que músculo.`,
    definicion: `Un ritmo razonable es bajar entre ${r(w * 0.005)} y ${r(w * 0.0075)} kg por semana, manteniendo tus cargas en el gimnasio.`,
    deficit: `Un ritmo sostenible es bajar entre ${r(w * 0.005)} y ${r(w * 0.01)} kg por semana. Ir más rápido no es mejor y cuesta más mantenerlo.`,
    mantener: 'Tu peso debería mantenerse estable, con variaciones de ±1 kg por día a día.',
  }
  const tips = [
    rate[phase],
    `Reparte tu proteína (${t.p} g al día) entre todas tus comidas: unos ${Math.round(t.p / slots.length)} g por comida.`,
    'Deja unas 3 a 5 horas entre comidas. Antes de entrenar come 1 a 3 horas antes; después, una comida con proteína y carbohidratos.',
    'Los horarios son una guía: muévelos para que encajen con tu día y con la hora a la que entrenas.',
    'Estas cifras son estimaciones. Pésate 2 o 3 semanas en condiciones parecidas (mañana, en ayunas) y, si el peso no se mueve como esperas, ajusta unas 100 a 150 kcal.',
  ]

  return { phase, tdee: t.tdee, kcal: t.kcal, p: t.p, c: t.c, fat: t.fat, meals, tips, warnings, weight: w, seed, createdAt: new Date().toISOString() }
}