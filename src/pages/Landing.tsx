import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const slides = [
  { n: '01', title: 'Entrena con un plan', text: 'Rutinas semanales según tu objetivo, tu nivel y los días que tienes disponibles.' },
  { n: '02', title: 'Come con criterio', text: 'Orientación de nutrición y suplementos basada en evidencia, sin promesas milagro.' },
  { n: '03', title: 'Entrena más seguro', text: 'Calentamientos, técnica y precauciones adaptadas a tus molestias.' },
  { n: '04', title: 'Mide tu progreso', text: 'Registra tus cargas y tu peso, y recibe recordatorios de entreno y agua.' },
]

export default function Landing() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI(p => (p + 1) % slides.length), 4500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="landing">
      <div className="brand">MIO<span>GYM</span></div>

      <div>
        <div className="carousel">
          <div className="track" style={{ transform: `translateX(-${i * 100}%)` }}>
            {slides.map(s => (
              <div className="slide" key={s.n}>
                <div className="num">{s.n}</div>
                <h1>{s.title}</h1>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="dots">
          {slides.map((_, n) => (
            <button key={n} className={n === i ? 'dot active' : 'dot'} onClick={() => setI(n)} aria-label={`Diapositiva ${n + 1}`} />
          ))}
        </div>
      </div>

      <div>
        <Link to="/registro" className="btn primary">Registrarse</Link>
        <Link to="/login" className="link">Ya tengo cuenta</Link>
      </div>
    </div>
  )
}