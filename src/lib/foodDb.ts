export interface Food { n: string; kcal: number; p: number; c: number; f: number; g: number; tags: string[]; u?: [string, number] }
export interface Item { name: string; grams: number | null; kcal: number; p: number; c: number; f: number; tags?: string[] }
export type VerdictKind = 'equilibrado' | 'aceptable' | 'mejorable'
export const VERDICT_LABEL: Record<VerdictKind, string> = { equilibrado: 'Equilibrado', aceptable: 'Aceptable', mejorable: 'Mejorable' }

export const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// valores por 100 g (aprox.), g = porción habitual en gramos, u = [unidad, gramos]
const F = (n: string, kcal: number, p: number, c: number, f: number, g: number, tags = '', u?: [string, number]): Food =>
  ({ n, kcal, p, c, f, g, tags: tags ? tags.split(',') : [], u })

export const FOODS: Food[] = [
  F('Pechuga de pollo cocida', 165, 31, 0, 3.6, 150),
  F('Muslo de pollo sin piel cocido', 175, 26, 0, 8, 130),
  F('Carne de res magra cocida', 200, 27, 0, 10, 150),
  F('Lomo de cerdo cocido', 200, 27, 0, 9, 120),
  F('Pescado blanco cocido', 120, 24, 0, 2.5, 150),
  F('Salmón cocido', 208, 22, 0, 13, 140),
  F('Atún en agua (escurrido)', 110, 25, 0, 1, 100),
  F('Huevo', 143, 12.6, 0.7, 9.5, 100, '', ['huevo', 50]),
  F('Claras de huevo', 52, 11, 0.7, 0.2, 100),
  F('Queso panela', 250, 18, 3, 19, 60),
  F('Queso Oaxaca / mozzarella', 300, 22, 2, 23, 40),
  F('Yogur griego natural', 70, 9, 4, 2, 170),
  F('Leche entera', 61, 3.2, 4.8, 3.3, 240),
  F('Frijoles cocidos', 130, 8, 22, 0.5, 150),
  F('Lentejas cocidas', 116, 9, 20, 0.4, 180),
  F('Garbanzos cocidos', 164, 8.9, 27, 2.6, 150),
  F('Tofu firme', 144, 15, 3, 9, 120),
  F('Arroz cocido', 130, 2.7, 28, 0.3, 150),
  F('Pasta cocida', 158, 5.8, 31, 0.9, 180),
  F('Tortilla de maíz', 218, 5.7, 45, 2.9, 60, '', ['tortilla', 30]),
  F('Tortilla de harina', 310, 8, 50, 8, 40, '', ['tortilla', 40]),
  F('Pan integral', 250, 12, 43, 4, 60, '', ['rebanada', 30]),
  F('Bolillo / pan blanco', 270, 9, 52, 3, 60, '', ['pieza', 60]),
  F('Avena cruda', 380, 13, 67, 7, 40),
  F('Papa cocida', 87, 1.9, 20, 0.1, 150),
  F('Camote cocido', 90, 2, 21, 0.2, 150),
  F('Plátano', 89, 1.1, 23, 0.3, 120, 'fruta', ['pieza', 120]),
  F('Manzana', 52, 0.3, 14, 0.2, 180, 'fruta', ['pieza', 180]),
  F('Fruta mixta', 50, 0.7, 12, 0.3, 150, 'fruta'),
  F('Aguacate', 160, 2, 9, 15, 70),
  F('Verduras mixtas cocidas', 35, 2, 7, 0.3, 100, 'veg'),
  F('Ensalada verde', 20, 1.5, 3.5, 0.2, 80, 'veg'),
  F('Nopales cocidos', 16, 1.3, 3.3, 0.1, 100, 'veg'),
  F('Brócoli cocido', 35, 2.4, 7, 0.4, 100, 'veg'),
  F('Jitomate', 18, 0.9, 3.9, 0.2, 100, 'veg'),
  F('Crema de cacahuate', 590, 25, 20, 50, 16, '', ['cucharada', 16]),
  F('Nueces / almendras', 600, 18, 20, 52, 30),
  F('Aceite', 884, 0, 0, 100, 14, '', ['cucharada', 14]),
  F('Papas fritas / frituras', 540, 6, 50, 35, 40, 'frito,ultra'),
  F('Pollo empanizado frito', 280, 18, 15, 16, 130, 'frito'),
  F('Hamburguesa con pan', 250, 13, 24, 11, 220, 'ultra'),
  F('Pizza', 270, 11, 33, 10, 120, 'ultra'),
  F('Refresco', 42, 0, 10.6, 0, 355, 'azucar'),
  F('Jugo de naranja', 45, 0.7, 10, 0.2, 240, 'azucar'),
  F('Pan dulce', 380, 7, 55, 14, 70, 'azucar'),
  F('Galletas dulces', 480, 6, 70, 20, 40, 'azucar'),
]

export const toItem = (f: Food, grams: number): Item => {
  const k = grams / 100, r = (x: number) => Math.round(x * 10) / 10
  return { name: f.n, grams: Math.round(grams), kcal: r(f.kcal * k), p: r(f.p * k), c: r(f.c * k), f: r(f.f * k), tags: f.tags }
}

export const totals = (items: Item[]) =>
  items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { kcal: 0, p: 0, c: 0, f: 0 })

/** Valoración por reglas: balance del plato, no solo calorías */
export function judge(items: Item[], meal: string) {
  const t = totals(items)
  const main = meal !== 'colacion'
  const reasons: string[] = [], tips: string[] = []
  let score = 0

  if (t.p >= (main ? 20 : 8)) { score++; reasons.push(`Aporta unos ${Math.round(t.p)} g de proteína, una buena cantidad para esta comida.`) }
  else tips.push(main ? 'Suma una fuente de proteína: huevo, pollo, pescado, frijoles, yogur o tofu.' : 'Una colación con algo de proteína sacia más: yogur, huevo o nueces.')

  if (items.some(i => i.tags?.includes('veg') || i.tags?.includes('fruta'))) { score++; reasons.push('Incluye verduras o fruta, que aportan fibra y micronutrientes.') }
  else tips.push('Agrega verduras o fruta para sumar fibra y vitaminas.')

  const bad = items.filter(i => i.tags?.some(x => ['frito', 'azucar', 'ultra'].includes(x)))
  if (bad.length === 0) { score++; reasons.push('No se ven frituras ni azúcares añadidos evidentes.') }
  else { score--; reasons.push(`Incluye ${bad.map(b => b.name.toLowerCase()).join(', ')}: va mejor de forma ocasional.`) }

  return { kind: (score >= 3 ? 'equilibrado' : score >= 1 ? 'aceptable' : 'mejorable') as VerdictKind, reasons, tips, t }
}