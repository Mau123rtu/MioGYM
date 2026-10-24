import { useState } from 'react'
import Icon from './Icons'
import { checkPassword } from '../lib/password'

export default function PasswordField({ value, onChange, placeholder = 'Contraseña', showRules, ctx, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  showRules?: boolean; ctx?: { username?: string; email?: string }; autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  const { rules } = checkPassword(value, ctx)
  return (
    <>
      <div className="pw">
        <input type={show ? 'text' : 'password'} placeholder={placeholder} value={value}
          autoComplete={autoComplete} onChange={e => onChange(e.target.value)} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          <Icon name={show ? 'eyeoff' : 'eye'} size={20} />
        </button>
      </div>
      {showRules && (
        <ul className="rules">
          {rules.map(r => <li key={r.label} className={r.ok ? 'ok' : ''}>{r.ok ? '✓' : '○'} {r.label}</li>)}
        </ul>
      )}
    </>
  )
}