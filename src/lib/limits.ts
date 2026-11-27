// src/lib/limits.ts

export const LIMITS = {
  weight: { min: 30, max: 250 }, // kg
  height: { min: 90, max: 250 }, // cm
}

// Límites de medidas corporales (cm). Ajusta los valores si lo necesitas.
export const MEASURE_LIMITS: Record<string, { min: number; max: number; label: string }> = {
  brazo:   { min: 10, max: 80,  label: 'Brazo' },
  pierna:  { min: 20, max: 120, label: 'Pierna' },
  cintura: { min: 40, max: 200, label: 'Cintura' },
  cadera:  { min: 50, max: 200, label: 'Cadera' },
  pecho:   { min: 50, max: 200, label: 'Pecho' },
}

/** Devuelve un mensaje de error o null si el valor es válido. */
export function validateMeasure(key: string, value: number): string | null {
  const l = MEASURE_LIMITS[key]
  if (!l) return null
  if (Number.isNaN(value) || value <= 0) return `${l.label}: ingresa un valor mayor a 0.`
  if (value < l.min || value > l.max) return `${l.label}: debe estar entre ${l.min} y ${l.max} cm.`
  return null
}

/** Evita escribir -, +, e, E en inputs type="number". */
export const blockInvalidKeys = (e: { key: string; preventDefault: () => void }) => {
  if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault()
}