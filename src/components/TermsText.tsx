import { TERMS, TERMS_DATE, TERMS_VERSION } from '../lib/terms'

export default function TermsText() {
  return (
    <div className="terms">
      <p className="hint">Versión {TERMS_VERSION} · {TERMS_DATE}</p>
      {TERMS.map(s => (
        <section key={s.title}>
          <h4>{s.title}</h4>
          {s.body.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
    </div>
  )
}