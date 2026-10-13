export const lbToKg = (lb: number) => lb * 0.45359237
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * 2.54

export function calcAge(birth: string | null): number | null {
  if (!birth) return null
  const b = new Date(birth), n = new Date()
  let age = n.getFullYear() - b.getFullYear()
  const m = n.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) age--
  return age
}

export function calcBMI(kg?: number | null, cm?: number | null) {
  if (!kg || !cm) return null
  const bmi = kg / Math.pow(cm / 100, 2)
  let label = 'Peso normal'
  if (bmi < 18.5) label = 'Bajo peso'
  else if (bmi >= 25 && bmi < 30) label = 'Sobrepeso'
  else if (bmi >= 30) label = 'Obesidad'
  return { value: Math.round(bmi * 10) / 10, label }
}