import { supabase } from './supabase'

const KEY = 'miogym-queue'
type Row = Record<string, unknown>
interface Item { id: string; uid: string; table: string; rows: Row[] }

const TABLES = new Set(['workout_logs', 'workout_sessions', 'food_logs', 'supplement_logs', 'walk_logs', 'weight_logs'])

const read = (): Item[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } }
const write = (q: Item[]) => { localStorage.setItem(KEY, JSON.stringify(q)); window.dispatchEvent(new Event('queue-changed')) }
export const pendingCount = () => read().length

// Errores que se arreglan solos: sin red o sesión vencida
const retryable = (msg = '') => !navigator.onLine || /fetch|network|jwt|expired|timeout/i.test(msg)

/** Inserta; si no hay internet, lo guarda en el teléfono y lo envía después. */
export async function safeInsert(table: string, data: Row | Row[]): Promise<{ error: string | null; queued: boolean }> {
  if (!TABLES.has(table)) throw new Error(`Tabla no permitida: ${table}`)
  const rows = Array.isArray(data) ? data : [data]
  if (!rows.length) return { error: null, queued: false }
  const uid = String(rows[0].user_id ?? '')

  if (navigator.onLine) {
    const { error } = await supabase.from(table).insert(rows)
    if (!error) return { error: null, queued: false }
    if (!retryable(error.message)) return { error: error.message, queued: false }
  }
  write([...read(), { id: crypto.randomUUID(), uid, table, rows }])
  return { error: null, queued: true }
}

let busy = false
/** Envía lo pendiente, en orden. Se detiene si vuelve a fallar la red. */
export async function flushQueue(): Promise<number> {
  if (busy || !navigator.onLine) return 0
  busy = true
  let sent = 0
  try {
    const { data } = await supabase.auth.getSession()   // renueva la sesión si venció
    const me = data.session?.user.id
    if (!me) return 0
    for (const item of read()) {
      if (item.uid !== me) continue                      // pertenece a otra cuenta
      const { error } = await supabase.from(item.table).insert(item.rows)
      if (error && retryable(error.message)) break
      if (error) console.error('Registro descartado por error:', item.table, error.message)
      write(read().filter(x => x.id !== item.id))
      if (!error) sent++
    }
  } finally { busy = false }
  return sent
}