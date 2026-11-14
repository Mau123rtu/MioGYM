import { supabase } from './supabase'

type Store = Record<string, { text: string; dirty: boolean }>
const key = (uid: string) => `miogym-notes-${uid}`
const read = (uid: string): Store => { try { return JSON.parse(localStorage.getItem(key(uid)) ?? '{}') } catch { return {} } }
const write = (uid: string, s: Store) => localStorage.setItem(key(uid), JSON.stringify(s))

async function push(uid: string, name: string, text: string) {
  const t = text.trim()
  const { error } = t
    ? await supabase.from('exercise_notes').upsert(
        { user_id: uid, exercise: name, note: t, updated_at: new Date().toISOString() }, { onConflict: 'user_id,exercise' })
    : await supabase.from('exercise_notes').delete().eq('exercise', name)
  if (error) return false
  const s = read(uid)
  if (s[name]) { s[name].dirty = false; write(uid, s) }
  return true
}

/** Notas guardadas de esos ejercicios (nube + las pendientes del teléfono) */
export async function loadNotes(uid: string, names: string[]): Promise<Record<string, string>> {
  const store = read(uid)
  const out: Record<string, string> = {}
  try {
    const { data } = await supabase.from('exercise_notes').select('exercise,note').in('exercise', names)
    data?.forEach(r => { out[r.exercise as string] = r.note as string })
  } catch { /* sin internet: se usa lo guardado en el teléfono */ }

  for (const n of names) {
    const l = store[n]
    if (l?.dirty) { out[n] = l.text; if (navigator.onLine) push(uid, n, l.text) }   // lo pendiente gana
    else if (out[n] !== undefined) store[n] = { text: out[n], dirty: false }
    else if (l) out[n] = l.text
  }
  write(uid, store)
  return out
}

/** Guarda en el teléfono al instante y en la nube si hay internet. true = ya está en la nube */
export async function saveNote(uid: string, name: string, text: string): Promise<boolean> {
  const s = read(uid)
  s[name] = { text, dirty: true }
  write(uid, s)
  if (!navigator.onLine) return false
  return push(uid, name, text)
}