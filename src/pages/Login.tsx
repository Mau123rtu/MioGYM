import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos')
    else navigate('/app')
  }

  return (
    <div className="wizard">
      <h2>Iniciar sesión</h2>
      <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn primary" onClick={submit}>Entrar</button>
      <Link to="/registro" className="link">Crear cuenta</Link>
    </div>
  )
}