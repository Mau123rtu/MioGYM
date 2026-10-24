export const MIN_LEN = 8

export interface Rule { ok: boolean; label: string }

export function checkPassword(pw: string, ctx: { username?: string; email?: string } = {}) {
  const user = (ctx.username ?? '').trim().toLowerCase()
  const mail = (ctx.email ?? '').split('@')[0].trim().toLowerCase()
  const low = pw.toLowerCase()
  const rules: Rule[] = [
    { ok: pw.length >= MIN_LEN, label: `Mínimo ${MIN_LEN} caracteres` },
    { ok: /[a-z]/.test(pw), label: 'Una letra minúscula' },
    { ok: /[A-Z]/.test(pw), label: 'Una letra mayúscula' },
    { ok: /\d/.test(pw), label: 'Un número' },
    { ok: /[^A-Za-z0-9\s]/.test(pw), label: 'Un carácter especial (! @ # $ % & * …)' },
    { ok: !/\d{4,}/.test(pw), label: 'No más de 3 números seguidos' },
    { ok: !/(.)\1{2,}/.test(pw), label: 'Sin 3 caracteres iguales seguidos' },
    { ok: !/\s/.test(pw), label: 'Sin espacios' },
    {
      ok: !(user.length >= 3 && low.includes(user)) && !(mail.length >= 3 && low.includes(mail)),
      label: 'No contiene tu usuario ni tu correo',
    },
  ]
  return { rules, valid: rules.every(r => r.ok) }
}