import { norm } from './foodDb'

export type Kind = 'preentreno' | 'proteina' | 'creatina' | 'cafeina' | 'aminoacidos' | 'carbohidratos' | 'vitaminas' | 'omega3' | 'magnesio' | 'quemador' | 'otro'
export type Level = 'ok' | 'caution' | 'avoid'
export interface Ing { name: string; amount: number | null; unit: string }
export interface SuppItem {
  id: number; name: string; brand: string | null; kind: Kind; serving: string | null
  ingredients: Ing[]; proprietary: boolean; photo_path: string | null; created_at: string
}
export interface SuppLog { id: number; taken_at: string; item_id: number | null; name: string; kind: Kind; caffeine_mg: number | null; servings: number; timing: string }
export interface Flag { level: 'info' | 'caution' | 'avoid'; text: string }
export interface Tip { kind: 'ok' | 'tip' | 'warn'; text: string }
export interface Ctx { age: number | null; medication: boolean }

export const LEVEL_LABEL: Record<Level, string> = { ok: 'Adecuado', caution: 'Con precauciones', avoid: 'Mejor evitarlo' }
export const STIM: Kind[] = ['preentreno', 'quemador', 'cafeina']

export interface KindInfo { label: string; fn: string; evidence: string; base: Level; when: string[]; pair: string[]; avoid: string[] }

export const KINDS: Record<Kind, KindInfo> = {
  preentreno: {
    label: 'Pre-entreno', evidence: 'media', base: 'caution',
    fn: 'Mezcla de estimulantes (casi siempre cafeína) y otros ingredientes para sentir más energía y enfoque al entrenar. El efecto principal suele venir de la cafeína.',
    when: ['Tómalo 20 a 40 minutos antes de entrenar, una sola vez al día.', 'Evítalo si entrenas por la tarde-noche o dormirás en menos de 6 horas.', 'Empieza con media porción para ver cómo lo toleras.'],
    pair: ['Agua suficiente.', 'Una comida ligera 1 a 2 horas antes.', 'Combina bien con creatina.'],
    avoid: ['No lo mezcles con café, bebidas energéticas ni otros estimulantes.', 'Evítalo con ansiedad, hipertensión, problemas del corazón o embarazo sin consultar.'],
  },
  proteina: {
    label: 'Proteína en polvo', evidence: 'alta', base: 'ok',
    fn: 'Ayuda a completar tu proteína total del día. Es comida práctica, no un suplemento "mágico".',
    when: ['No tiene hora obligatoria: importa la proteína total del día.', 'Es cómoda después de entrenar o cuando no llegas a tu meta con comida.', 'Una porción típica aporta 20 a 30 g.'],
    pair: ['Con agua, leche o fruta; con avena si buscas más calorías.', 'Combina bien con creatina.'],
    avoid: ['Si eres intolerante a la lactosa, prueba aislado o vegetal.', 'No reemplaces comidas completas todo el día.'],
  },
  creatina: {
    label: 'Creatina', evidence: 'alta', base: 'ok',
    fn: 'Ayuda a producir energía rápida en esfuerzos cortos e intensos. Con entrenamiento mejora fuerza y masa muscular.',
    when: ['3 a 5 g al día, todos los días, también en descanso.', 'La hora da igual; lo importante es la constancia.', 'No necesita fase de carga.'],
    pair: ['Con comida o con carbohidratos y proteína, para evitar molestias.', 'Bebe agua a lo largo del día.'],
    avoid: ['Consulta a tu médico si tienes problemas de riñón.', 'No necesitas más de 5 g.'],
  },
  cafeina: {
    label: 'Cafeína', evidence: 'alta', base: 'caution',
    fn: 'Estimulante que reduce la sensación de fatiga y mejora el rendimiento.',
    when: ['Unos 3 mg por kg de peso, 30 a 60 min antes de entrenar. La mayoría no necesita más de 200 mg por toma.', 'Máximo 400 mg al día en adultos sanos, sumando café, té y bebidas energéticas.', 'Evítala unas 6 horas antes de dormir.'],
    pair: ['Con agua.', 'Con creatina no hay problema.'],
    avoid: ['No la mezcles con otros estimulantes.', 'Evítala o consulta con ansiedad, hipertensión, arritmias o embarazo.'],
  },
  aminoacidos: {
    label: 'Aminoácidos (BCAA / EAA)', evidence: 'media', base: 'ok',
    fn: 'Son los bloques de la proteína. Si ya comes suficiente proteína, aportan poco extra.',
    when: ['Pueden servir en entrenos largos o en ayunas.', 'Si tu proteína diaria ya es alta, probablemente no los necesitas.'],
    pair: ['Los EAA completos son mejor opción que solo BCAA.', 'Con agua durante el entreno.'],
    avoid: ['Una porción de proteína en polvo suele rendir igual y cuesta menos.'],
  },
  carbohidratos: {
    label: 'Carbohidratos / glucosa', evidence: 'media', base: 'ok',
    fn: 'Energía rápida (glucosa, dextrosa, maltodextrina) para sesiones largas e intensas y para recuperar el glucógeno.',
    when: ['Sirven en entrenos de más de 60 a 90 min o con poco tiempo entre sesiones.', 'Después de entrenar, junto con proteína, ayudan a recuperarte.', 'En un entreno normal de 45 a 60 min, una fruta o comida suele bastar.'],
    pair: ['Con proteína después de entrenar.', 'Con agua y electrolitos si sudas mucho.'],
    avoid: ['No hace falta tomarlo todo el día: el exceso suma azúcar.', 'Con diabetes o resistencia a la insulina, consulta con tu médico.'],
  },
  vitaminas: {
    label: 'Vitaminas y minerales', evidence: 'variable', base: 'caution',
    fn: 'Cubren deficiencias o dietas restrictivas. Si comes variado, normalmente no aportan beneficio extra.',
    when: ['Con una comida que tenga algo de grasa si son vitaminas A, D, E o K.', 'Sigue la dosis de la etiqueta.'],
    pair: ['El hierro, lejos del café, el té y los lácteos.'],
    avoid: ['Más no es mejor: en exceso, varias vitaminas y minerales dañan.', 'Un análisis de sangre dice qué necesitas realmente.'],
  },
  omega3: {
    label: 'Omega-3', evidence: 'media', base: 'ok',
    fn: 'Grasas EPA y DHA, útiles para la salud del corazón y como apoyo a la recuperación. El efecto en rendimiento es pequeño.',
    when: ['Con una comida que tenga grasa.', 'Dosis habitual: 1 a 2 g de EPA + DHA al día.'],
    pair: ['Con la comida principal.'],
    avoid: ['Consulta si tomas anticoagulantes.', 'Con alergia al pescado, busca versión de algas.'],
  },
  magnesio: {
    label: 'Magnesio', evidence: 'media', base: 'ok',
    fn: 'Mineral que participa en la función muscular y en el sueño. Ayuda si tu ingesta es baja.',
    when: ['Por la noche suele sentar bien.', 'Con comida si te afecta el estómago.'],
    pair: ['El glicinato o el citrato se toleran mejor que el óxido.'],
    avoid: ['En dosis altas puede dar diarrea.', 'Con problemas de riñón, consulta antes.'],
  },
  quemador: {
    label: 'Quemador de grasa', evidence: 'baja', base: 'caution',
    fn: 'Suelen ser estimulantes (cafeína y otros) con poca evidencia de que quemen grasa de forma relevante.',
    when: ['Lo que baja la grasa es el déficit calórico sostenido, no el producto.', 'Si decides usarlo, nunca junto a pre-entreno ni café.'],
    pair: [],
    avoid: ['Evítalo con ansiedad, hipertensión, problemas del corazón, embarazo o si eres menor de edad.', 'Desconfía de los que prometen resultados rápidos.'],
  },
  otro: {
    label: 'Otro', evidence: 'variable', base: 'caution',
    fn: 'Sin una categoría definida, el análisis se basa solo en los ingredientes que registres.',
    when: ['Sigue la dosis y las instrucciones de la etiqueta.'],
    pair: [],
    avoid: ['Si no conoces un ingrediente, búscalo antes de tomarlo o pregunta a un profesional.'],
  },
}

/** Ingredientes típicos por tipo, para rellenar rápido. Son valores de ejemplo: ajústalos a tu etiqueta. */
export const PRESETS: Partial<Record<Kind, Ing[]>> = {
  creatina: [{ name: 'Creatina monohidratada', amount: 5, unit: 'g' }],
  proteina: [{ name: 'Proteína', amount: 25, unit: 'g' }],
  cafeina: [{ name: 'Cafeína', amount: 200, unit: 'mg' }],
  preentreno: [
    { name: 'Cafeína', amount: 200, unit: 'mg' },
    { name: 'Beta-alanina', amount: 3200, unit: 'mg' },
    { name: 'Citrulina', amount: 6000, unit: 'mg' },
  ],
  aminoacidos: [{ name: 'Aminoácidos esenciales', amount: 10, unit: 'g' }],
  carbohidratos: [{ name: 'Carbohidratos (dextrosa)', amount: 30, unit: 'g' }],
  omega3: [{ name: 'EPA + DHA', amount: 1000, unit: 'mg' }],
  magnesio: [{ name: 'Magnesio', amount: 200, unit: 'mg' }],
  vitaminas: [{ name: 'Vitamina D', amount: 25, unit: 'mcg' }],
  quemador: [{ name: 'Cafeína', amount: 150, unit: 'mg' }],
}

/* ---------- Ingredientes ---------- */
const UNIT: Record<string, number> = { g: 1000, gr: 1000, kg: 1e6, mg: 1, mcg: 0.001, ug: 0.001, 'µg': 0.001 }
export function toMg(i: Ing, iu = 0): number | null {
  if (i.amount === null || !(i.amount >= 0)) return null
  const u = i.unit.toLowerCase().trim()
  if (u === 'ui' || u === 'iu') return iu ? i.amount * iu : null
  return UNIT[u] !== undefined ? i.amount * UNIT[u] : null
}

const ULS: { re: RegExp; mg: number; label: string; iu?: number; extra?: string }[] = [
  { re: /\bzinc\b/, mg: 40, label: 'zinc' },
  { re: /hierro|\biron\b/, mg: 45, label: 'hierro' },
  { re: /magnesio|magnesium/, mg: 350, label: 'magnesio' },
  { re: /vitamina c\b|ascorb/, mg: 2000, label: 'vitamina C' },
  { re: /vitamina b6|piridoxin/, mg: 100, label: 'vitamina B6' },
  { re: /selenio|selenium/, mg: 0.4, label: 'selenio' },
  { re: /vitamina a\b|retinol|retinil/, mg: 3, label: 'vitamina A', iu: 0.0003 },
  { re: /vitamina d|colecalciferol|cholecalciferol/, mg: 0.1, label: 'vitamina D', iu: 0.000025 },
  { re: /niacina|niacin|vitamina b3/, mg: 35, label: 'niacina', extra: 'Puede causar enrojecimiento y hormigueo en la piel.' },
]
const DANGER: [RegExp, string][] = [
  [/sinefrina|synephrine|naranja amarga|bitter orange/, 'sinefrina'],
  [/yohimbin/, 'yohimbina'],
  [/dmaa|metilhexanamina|methylhexanamine/, 'DMAA'],
  [/efedra|ephedra|ma huang|efedrina/, 'efedra'],
  [/dmha|octodrina|octodrine/, 'DMHA'],
  [/sibutramina|sibutramine/, 'sibutramina'],
]
const fmtUL = (mg: number) => (mg < 1 ? `${Math.round(mg * 1000)} mcg` : `${mg} mg`)

export function analyzeItem(item: Pick<SuppItem, 'kind' | 'ingredients' | 'proprietary'>, ctx: Ctx) {
  const K = KINDS[item.kind] ?? KINDS.otro
  const ings = item.ingredients ?? []
  const names = ings.map(i => ({ i, n: norm(i.name) }))
  const flags: Flag[] = []
  const positives: string[] = []

  // Cafeína y otros estimulantes
  const caff = Math.round(names.filter(x => /cafeina|caffeine/.test(x.n)).reduce((s, x) => s + (toMg(x.i) ?? 0), 0))
  const hidden = names.some(x => /guarana|yerba mate|mate\b/.test(x.n))
  const danger = names.flatMap(x => DANGER.filter(([re]) => re.test(x.n)).map(([, l]) => l))
  const stimulant = caff > 0 || hidden || danger.length > 0

  if (caff > 400) flags.push({ level: 'avoid', text: `${caff} mg de cafeína por porción: supera el máximo diario de 400 mg para adultos sanos.` })
  else if (caff > 200) flags.push({ level: 'caution', text: `${caff} mg de cafeína por porción es una dosis alta: cubre más de la mitad de tu límite diario (400 mg). Considera media porción.` })
  else if (caff > 0) flags.push({ level: 'info', text: `${caff} mg de cafeína por porción (≈ ${Math.round(caff / 95 * 10) / 10} tazas de café). Súmalo al café y té del día.` })
  if (hidden) flags.push({ level: 'info', text: 'Contiene guaraná o yerba mate, que aportan cafeína extra que a veces no aparece contada.' })
  Array.from(new Set(danger)).forEach(d => flags.push({ level: 'avoid', text: `Contiene ${d}: estimulante que puede subir mucho el pulso y la presión, y está prohibido o restringido en varios países. Es mejor evitarlo.` }))

  // Dosis de otros ingredientes
  names.forEach(({ i, n }) => {
    const mg = toMg(i)
    if (/creatina|creatine/.test(n) && mg !== null && mg > 5000)
      flags.push({ level: 'caution', text: `${i.amount} ${i.unit} de creatina por porción: más de 5 g no aporta beneficio extra.` })
    if (/beta.?alanina|beta.?alanine/.test(n))
      flags.push({ level: 'info', text: 'La beta-alanina puede dar hormigueo en la piel (parestesia). Es inofensivo y pasa en minutos.' })
    if (/citrulina|citrulline/.test(n) && mg !== null)
      flags.push({ level: 'info', text: mg < 3000 ? `Citrulina en dosis baja (${i.amount} ${i.unit}); los estudios suelen usar 6 a 8 g.` : 'Citrulina en una dosis cercana a lo estudiado.' })
    if (/azucar|sugar|dextros|maltodextrin/.test(n) && item.kind !== 'carbohidratos')
      flags.push({ level: 'info', text: 'Contiene azúcares añadidos.' })
  })
  ULS.forEach(u => names.filter(x => u.re.test(x.n)).forEach(x => {
    const mg = toMg(x.i, u.iu ?? 0)
    if (mg === null) return
    const base = `${x.i.name}: ${x.i.amount} ${x.i.unit} por porción`
    if (mg > u.mg * 2) flags.push({ level: 'avoid', text: `${base} es más del doble del máximo diario seguro (≈ ${fmtUL(u.mg)}). ${u.extra ?? ''}`.trim() })
    else if (mg > u.mg) flags.push({ level: 'caution', text: `${base} supera el máximo diario seguro (≈ ${fmtUL(u.mg)}). ${u.extra ?? ''}`.trim() })
  }))

  // Etiqueta
  if (item.proprietary) flags.push({ level: 'caution', text: 'Tiene una "mezcla propietaria": no sabes cuánto lleva de cada ingrediente, así que es difícil juzgar su dosis.' })
  if (ings.length === 0) flags.push({ level: 'info', text: 'No registraste ingredientes: este análisis es general. Agrégalos para uno más preciso.' })
  else if (!item.proprietary && ings.some(i => i.amount === null)) flags.push({ level: 'info', text: 'Faltan cantidades de algunos ingredientes. Revisa la etiqueta para completarlas.' })

  // Contexto del usuario
  const minor = ctx.age !== null && ctx.age < 18
  if (minor && (stimulant || STIM.includes(item.kind))) flags.push({ level: 'avoid', text: 'Eres menor de edad: no se recomiendan estimulantes, pre-entrenos ni quemadores.' })
  else if (minor) flags.push({ level: 'caution', text: 'Eres menor de edad: consulta con un médico antes de usar suplementos.' })
  if (ctx.medication) flags.push({ level: 'caution', text: 'Indicaste medicamentos o una indicación médica: consulta a tu médico o farmacéutico por posibles interacciones antes de usarlo.' })
  if (stimulant) flags.push({ level: 'info', text: 'Si tienes ansiedad, hipertensión, problemas del corazón, o estás embarazada o lactando, consúltalo antes.' })

  // Valoración
  let verdict: Level = K.base
  if (item.kind === 'preentreno' && ings.length > 0 && !stimulant) {
    verdict = 'ok'
    positives.push('No detectamos estimulantes en la lista de ingredientes.')
  }
  flags.forEach(f => { if (f.level === 'avoid') verdict = 'avoid'; else if (f.level === 'caution' && verdict === 'ok') verdict = 'caution' })
  positives.unshift(`Evidencia científica: ${K.evidence}.`)
  if (verdict === 'ok') positives.push('No vemos señales de alerta en lo que registraste.')

  return { verdict, K, flags, positives, caffeine: caff }
}

/* ---------- Momento de la toma ---------- */
export function timingTips(kind: Kind, caff: number, timing: string, hour: number): Tip[] {
  const t: Tip[] = []
  const stim = caff > 0 || kind === 'preentreno' || kind === 'cafeina'
  if (stim && (timing === 'noche' || hour >= 16))
    t.push({ kind: 'warn', text: 'La cafeína tarda unas 6 horas en bajar a la mitad. Tomarla por la tarde o noche puede arruinar tu sueño, y dormir mal frena tu recuperación.' })
  else if (stim && (timing === 'pre' || timing === 'manana'))
    t.push({ kind: 'ok', text: 'Buen momento: la cafeína rinde mejor 30 a 60 minutos antes de entrenar, y a esta hora no debería afectar tu sueño.' })
  if (kind === 'preentreno' && timing === 'post') t.push({ kind: 'tip', text: 'El pre-entreno está pensado para antes de entrenar. Después no ayuda y solo suma estimulantes.' })
  if (kind === 'proteina') t.push({ kind: 'ok', text: 'Antes, durante o después funciona igual: lo que cuenta es la proteína total del día.' })
  if (kind === 'creatina') t.push({ kind: 'ok', text: 'La hora da igual. Lo importante es tomarla todos los días, incluso los de descanso.' })
  if (kind === 'magnesio') t.push({ kind: timing === 'noche' ? 'ok' : 'tip', text: timing === 'noche' ? 'Buen momento: por la noche suele ayudar al descanso.' : 'Muchos lo prefieren por la noche, aunque la hora no es crítica.' })
  if (kind === 'carbohidratos') t.push(['pre', 'durante', 'post'].includes(timing)
    ? { kind: 'ok', text: 'Buen momento: los carbohidratos en polvo rinden más alrededor del entrenamiento.' }
    : { kind: 'tip', text: 'Fuera del entrenamiento, una comida o fruta suele ser mejor opción que el polvo.' })
  if (kind === 'vitaminas' || kind === 'omega3') t.push({ kind: 'tip', text: 'Tómalo con una comida que tenga algo de grasa para absorberlo mejor.' })
  if (kind === 'aminoacidos' && ['pre', 'durante'].includes(timing)) t.push({ kind: 'ok', text: 'Buen momento: sirven sobre todo en entrenos largos o en ayunas.' })
  return t
}

/* ---------- Revisión del día ---------- */
export function dayCheck(logs: SuppLog[], ctx: Ctx): Tip[] {
  const tips: Tip[] = []
  if (!logs.length) return tips
  const minor = ctx.age !== null && ctx.age < 18
  const limit = minor ? 100 : 400
  const mg = Math.round(logs.reduce((s, l) => s + Number(l.caffeine_mg ?? 0) * Number(l.servings ?? 1), 0))

  if (mg > limit) tips.push({ kind: 'warn', text: `Llevas ${mg} mg de cafeína hoy, por encima del límite de ${limit} mg${minor ? ' recomendado a tu edad' : ''}. Evita más cafeína hoy, y recuerda que el café, té y refrescos también suman.` })
  else if (mg > limit * 0.75) tips.push({ kind: 'tip', text: `Llevas ${mg} mg de cafeína, cerca del límite de ${limit} mg. Sin contar café, té ni refrescos que no registraste aquí.` })
  else if (mg > 0) tips.push({ kind: 'ok', text: `Llevas ${mg} mg de cafeína hoy, dentro del límite de ${limit} mg (sin contar café o té que no hayas registrado).` })

  if (logs.some(l => Number(l.caffeine_mg) > 0 && new Date(l.taken_at).getHours() >= 16))
    tips.push({ kind: 'warn', text: 'Tomaste cafeína después de las 4 pm. Puede dificultar que duermas bien esta noche.' })

  const stimNames = Array.from(new Set(logs.filter(l => Number(l.caffeine_mg) > 0 || STIM.includes(l.kind)).map(l => l.name)))
  if (stimNames.length >= 2)
    tips.push({ kind: 'warn', text: `Combinaste varios productos con estimulantes (${stimNames.join(', ')}). Se suman y pueden causar nerviosismo, taquicardia o insomnio. Mejor usa uno solo.` })

  if (logs.filter(l => l.kind === 'preentreno').length > 1)
    tips.push({ kind: 'warn', text: 'Tomaste el pre-entreno más de una vez hoy. Con una toma, antes de entrenar, basta.' })
  if (logs.filter(l => l.kind === 'creatina').length > 1)
    tips.push({ kind: 'tip', text: 'Tomaste creatina más de una vez hoy. Con 3 a 5 g al día en total es suficiente.' })

  const kinds = new Set(logs.map(l => l.kind))
  if (kinds.has('creatina') && (kinds.has('proteina') || kinds.has('carbohidratos') || kinds.has('preentreno')))
    tips.push({ kind: 'ok', text: 'Creatina con proteína, carbohidratos o pre-entreno es una combinación segura y común.' })
  return tips
}