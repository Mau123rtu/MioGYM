import { useNavigate } from 'react-router-dom'
import TermsText from '../components/TermsText'

export default function Terms() {
  const nav = useNavigate()
  return (
    <div className="wizard">
      <button className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}>← Volver</button>
      <h2>Términos y condiciones</h2>
      <TermsText />
    </div>
  )
}