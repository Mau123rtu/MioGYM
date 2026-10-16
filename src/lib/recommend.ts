import { CATALOG, type G, type PlanExercise } from './routine'

export interface Tip { kind: 'ok' | 'tip' | 'warn'; text: string }

const NAME: Record<G, string> = {
  pecho: 'pecho', espalda: 'espalda', hombros: 'hombros',
  brazos: 'brazos', piernas: 'piernas', abdomen: 'abdomen',
}
// grandes primero, pequeños al final
const RANK: Record<G, number> = { piernas: 0, espalda: 0, pecho: 0, hombros: 1, brazos: 2, abdomen: 2 }

export function recommend(exs: PlanExercise[], blocked: Set<string>): Tip[] {
  const tips: Tip[] = []
  const items = exs.map(e => ({ e, c: CATALOG.find(x => x.n === e.name) })).filter(x => x.c) as
    { e: PlanExercise; c: (typeof CATALOG)[number] }[]
  const groups = items.map(x => x.c.g)
  const set = new Set(groups)
  const has = (g: G) => set.has(g)
  const count = (g: G) => groups.filter(x => x === g).length
  const n = exs.length

  // 1. Zonas con molestia (prioridad)
  items.forEach(({ e, c }) => {
    const hit = c.z.filter(z => blocked.has(z))
    if (hit.length)
      tips.push({ kind: 'warn', text: `"${e.name}" carga ${hit.join(' y ')}, zona donde reportaste molestia. Cámbialo por otro o consúltalo con un profesional.` })
  })

  // 2. Tamaño de la sesión
  if (n < 3) tips.push({ kind: 'tip', text: 'Tu rutina tiene pocos ejercicios. Con 4 a 6 ejercicios cubres bien una sesión.' })
  else if (n > 10) tips.push({ kind: 'warn', text: `Tienes ${n} ejercicios: la sesión será muy larga y la calidad baja al final. Considera dividirla en dos rutinas.` })
  else tips.push({ kind: 'ok', text: `${n} ejercicios es una cantidad razonable para una sesión.` })

  // 3. Combinaciones de grupos
  if (set.size === 1) {
    tips.push({ kind: 'ok', text: `Rutina de un solo grupo (${NAME[groups[0]]}). Déjalo descansar de 48 a 72 horas antes de repetirlo.` })
  } else {
    if (has('pecho') && has('hombros') && !has('espalda'))
      tips.push({ kind: 'ok', text: 'Pecho con hombros (y tríceps) es una combinación clásica de empuje: se pueden juntar sin problema.' })
    if (has('espalda') && has('brazos') && !has('pecho'))
      tips.push({ kind: 'ok', text: 'Espalda con bíceps funciona bien: el bíceps ya participa en los jalones y remos.' })
    if (has('pecho') && has('espalda'))
      tips.push({ kind: 'ok', text: 'Pecho y espalda son músculos opuestos y se pueden entrenar juntos. Cuida que la sesión no se alargue.' })
    if (has('piernas') && has('abdomen') && set.size === 2)
      tips.push({ kind: 'ok', text: 'Piernas con abdomen es una buena combinación.' })
  }
  const torso = (['pecho', 'espalda', 'hombros', 'brazos'] as G[]).filter(has).length
  if (has('piernas') && torso >= 3)
    tips.push({ kind: 'tip', text: 'Juntas piernas con casi todo el torso: te dejará muy fatigado. Se recomienda separarlas en dos días (torso y piernas).' })
  if (set.size >= 5)
    tips.push({ kind: 'tip', text: 'Trabajas casi todo el cuerpo: es un enfoque de cuerpo completo. Usa 1 o 2 ejercicios por grupo y repítela 2 o 3 días no consecutivos.' })
  if (exs.some(e => e.name === 'Peso muerto rumano') && has('piernas'))
    tips.push({ kind: 'tip', text: 'El peso muerto rumano junto con sentadillas o puentes carga mucho la zona lumbar y la cadera. Evita dejar ambos muy pesados el mismo día.' })

  // 4. Equilibrio empuje / tirón
  const push = count('pecho') + count('hombros')
  if (push >= 3 && count('espalda') === 0)
    tips.push({ kind: 'tip', text: 'Solo tienes ejercicios de empuje. Añade un remo o jalón para equilibrar y cuidar tus hombros.' })

  // 5. Demasiados del mismo músculo
  ;(Object.keys(NAME) as G[]).forEach(g => {
    if (g !== 'abdomen' && count(g) > 4)
      tips.push({ kind: 'tip', text: `Tienes ${count(g)} ejercicios de ${NAME[g]}. Con 3 o 4 suele bastar; más no siempre rinde más.` })
  })

  // 6. Orden
  const ranks = groups.map(g => RANK[g])
  if (ranks.some((r, i) => i > 0 && r < ranks[i - 1]))
    tips.push({ kind: 'tip', text: 'Orden sugerido: pon primero los ejercicios de músculos grandes (piernas, espalda, pecho) y al final brazos y abdomen, cuando tienes menos fatiga.' })

  // 7. Frecuencia
  tips.push({ kind: 'tip', text: 'Se recomienda repetir cada músculo unas 2 veces por semana, con al menos 48 horas de descanso entre sesiones del mismo grupo. Ajusta según tu recuperación.' })

  return tips
}