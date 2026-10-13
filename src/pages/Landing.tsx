import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const slides = [
  { emoji: '💪', title: 'Bienvenido a MioGym', text: 'Tu compañero para entrenar, comer mejor y cuidar tu cuerpo.' },
  { emoji: '📋', title: 'Rutinas a tu medida', text: 'Ejercicios y rutinas según tu objetivo, nivel y tiempo disponible.' },
  { emoji: '🥗', title: 'Nutrición y suplementos', text: 'Aprende a alimentarte y a usar suplementos de forma segura.' },
  { emoji: '⏰', title: 'Recordatorios', text: 'Te avisamos cuándo entrenar y cuándo tomar agua.' },
]

export default function Landing() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI(p => (p + 1) % slides.length), 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="landing">
      <div className="carousel">
        <div className="track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {slides.map(s => (
            <div className="slide" key={s.title}>
              <div className="emoji">{s.emoji}</div>
              <h1>{s.title}</h1>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="dots">
        {slides.map((_, n) => (
          <button key={n} className={n === i ? 'dot active' : 'dot'} onClick={() => setI(n)} aria-label={`Slide ${n + 1}`} />
        ))}
      </div>
      <Link to="/registro" className="btn primary">Registrarse</Link>
      <Link to="/login" className="link">Ya tengo cuenta</Link>
    </div>
  )
}