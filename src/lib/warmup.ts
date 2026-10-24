import { groupOf, type PlanDay } from './routine'

export interface WStep { name: string; detail: string; sec: number }
export interface Warmup { groups: string[]; steps: WStep[]; totalSec: number }
export interface CardioRec { mode: 'caminadora' | 'caminar'; title: string; options: number[]; suggested: number; tips: string[]; why: string[] }

const NAME: Record<string, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros',
  brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}

const SPECIFIC: Record<string, WStep[]> = {
  pecho: [
    { name: 'Círculos grandes de brazos', detail: '10 hacia adelante y 10 hacia atrás, aumentando el recorrido poco a poco.', sec: 40 },
    { name: 'Apertura y cierre de pecho', detail: 'Abre los brazos y llévalos al frente, 12 repeticiones controladas.', sec: 40 },
    { name: 'Flexiones lentas en pared o inclinadas', detail: '10 repeticiones suaves, sin llegar al cansancio.', sec: 40 },
  ],
  espalda: [
    { name: 'Gato-vaca', detail: 'En cuatro apoyos, arquea y redondea la espalda, 10 repeticiones.', sec: 40 },
    { name: 'Rotación de columna torácica', detail: 'En cuatro apoyos, mano en la nuca y gira el codo hacia el techo, 8 por lado.', sec: 50 },
    { name: 'Retracción de omóplatos', detail: 'Junta los omóplatos como en un remo, con o sin banda, 12 repeticiones.', sec: 40 },
  ],
  hombros: [
    { name: 'Círculos de hombros', detail: 'Círculos amplios hacia atrás y hacia adelante, 10 de cada uno.', sec: 40 },
    { name: 'Rotación externa con banda o sin peso', detail: 'Codo pegado al costado, gira el antebrazo hacia afuera, 12 por lado.', sec: 50 },
    { name: 'Elevaciones laterales sin peso', detail: 'Eleva los brazos hasta la altura de los hombros, 12 repeticiones.', sec: 40 },
  ],
  brazos: [
    { name: 'Círculos de muñecas y codos', detail: 'Mueve las articulaciones en ambos sentidos, 10 de cada una.', sec: 40 },
    { name: 'Flexión y extensión de codos sin peso', detail: 'Repeticiones lentas, 15 en total.', sec: 40 },
  ],
  piernas: [
    { name: 'Sentadilla sin peso', detail: '12 repeticiones, bajando cada vez un poco más.', sec: 60 },
    { name: 'Balanceo de piernas', detail: 'Apóyate en una pared y balancea cada pierna adelante y atrás, 10 por lado.', sec: 60 },
    { name: 'Zancadas caminando', detail: '10 pasos, con el torso erguido.', sec: 60 },
    { name: 'Puente de glúteo', detail: '12 repeticiones, apretando los glúteos arriba.', sec: 45 },
  ],
  abdomen: [
    { name: 'Gato-vaca', detail: 'En cuatro apoyos, arquea y redondea la espalda, 10 repeticiones.', sec: 40 },
    { name: 'Rotación de tronco', detail: 'De pie, gira el torso a ambos lados con control, 10 por lado.', sec: 40 },
  ],
}

export function buildWarmup(day: PlanDay, place: string | null): Warmup {
  const sets: Record<string, number> = {}
  day.exercises.forEach(e => { const g = groupOf(e.name); if (g) sets[g] = (sets[g] ?? 0) + e.sets })
  const groups = Object.entries(sets).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 2)

  const cardio = place === 'gimnasio' ? 'Cardio ligero: bici, caminadora o elíptica'
    : place === 'aire_libre' ? 'Caminata rápida o trote suave'
    : 'Cardio ligero en casa: marcha en sitio o saltos suaves'

  const steps: WStep[] = [{
    name: cardio, detail: 'Ritmo cómodo, que puedas hablar. Busca sentir calor y respirar un poco más rápido.',
    sec: groups.includes('piernas') ? 240 : 180,
  }]
  const seen = new Set<string>()
  groups.forEach(g => {
    SPECIFIC[g].slice(0, g === 'piernas' ? 4 : 2).forEach(s => {
      if (!seen.has(s.name)) { seen.add(s.name); steps.push(s) }
    })
  })
  const first = day.exercises[0]?.name
  steps.push({
    name: 'Series de aproximación',
    detail: first
      ? `Haz 1 o 2 series de "${first}" con un peso ligero (alrededor de la mitad del habitual) y pocas repeticiones.`
      : 'Haz 1 o 2 series ligeras de tu primer ejercicio.',
    sec: 60,
  })

  let total = steps.reduce((a, s) => a + s.sec, 0)
  if (total < 300) { steps[0].sec += 300 - total; total = 300 }   // mínimo 5 minutos
  return { groups: groups.map(g => NAME[g]), steps, totalSec: total }
}

export function cardioRec(place: string | null, goal: string | null): CardioRec {
  const suggested = ({ grasa: 20, condicion: 15, saludable: 15, fuerza: 10, masa: 10 } as Record<string, number>)[goal ?? ''] ?? 10
  const gym = place === 'gimnasio'
  return {
    mode: gym ? 'caminadora' : 'caminar',
    title: gym ? 'Camina unos minutos en la caminadora' : 'Sal a caminar unos minutos',
    options: [5, 10, 15, 20, 30],
    suggested,
    tips: [
      gym ? 'Usa poca o ninguna inclinación y baja la velocidad de forma gradual al final.' : 'Camina a paso tranquilo, en un lugar seguro y con calzado cómodo.',
      'El ritmo debe ser ligero o moderado: que puedas conversar sin ahogarte.',
      'Es opcional. Si hoy estás muy cansado o con molestias, puedes saltártela.',
    ],
    why: [
      'Ayuda a que el pulso y la respiración bajen de forma gradual después del esfuerzo.',
      'Mantiene la circulación activa, y a muchas personas les ayuda a sentirse mejor y menos rígidas después de entrenar.',
      'Suma actividad aeróbica, buena para el corazón y la salud en general, y suma un gasto de energía extra sin agotarte.',
    ],
  }
}