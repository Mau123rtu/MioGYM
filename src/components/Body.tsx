import { useAuth } from '../context/AuthContext'
import type { G } from '../lib/routine'

const NAMES: Record<G, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros',
  brazos: 'Bíceps y tríceps', piernas: 'Piernas y glúteos', abdomen: 'Abdomen',
}
const BASE = '#1d1d1d'

export const useFemale = () => useAuth().profile?.sex === 'mujer'

interface FigProps {
  view: 'front' | 'back'
  female: boolean
  fill: (g: G) => string
  on?: (g: G) => Record<string, unknown>
}

function Fig({ view, female, fill, on }: FigProps) {
  const p = (g: G) => ({ fill: fill(g), ...(on ? on(g) : {}) })
  const front = view === 'front'

  const head = female ? (
    <>
      <rect x="37" y="18" width="26" height="24" rx="10" fill="#2b2b2b" />
      <circle cx="50" cy="17" r="10" fill={BASE} />
      <rect x="46" y="26" width="8" height="9" fill={BASE} />
    </>
  ) : (
    <>
      <circle cx="50" cy="17" r="11" fill={BASE} />
      <rect x="45" y="27" width="10" height="9" fill={BASE} />
    </>
  )

  if (!female) {
    return (
      <svg viewBox="0 0 100 190" role="img" aria-label={front ? 'Vista frontal' : 'Vista posterior'}>
        {head}
        <circle cx="27" cy="45" r="8" {...p('hombros')} />
        <circle cx="73" cy="45" r="8" {...p('hombros')} />
        {front ? (
          <>
            <rect x="33" y="40" width="16" height="20" rx="6" {...p('pecho')} />
            <rect x="51" y="40" width="16" height="20" rx="6" {...p('pecho')} />
            <rect x="36" y="63" width="28" height="34" rx="6" {...p('abdomen')} />
            <rect x="34" y="100" width="14" height="82" rx="6" {...p('piernas')} />
            <rect x="52" y="100" width="14" height="82" rx="6" {...p('piernas')} />
          </>
        ) : (
          <>
            <rect x="33" y="40" width="34" height="42" rx="9" {...p('espalda')} />
            <rect x="34" y="85" width="32" height="16" rx="7" {...p('piernas')} />
            <rect x="34" y="104" width="14" height="78" rx="6" {...p('piernas')} />
            <rect x="52" y="104" width="14" height="78" rx="6" {...p('piernas')} />
          </>
        )}
        <rect x="15" y="54" width="10" height="42" rx="5" {...p('brazos')} />
        <rect x="75" y="54" width="10" height="42" rx="5" {...p('brazos')} />
      </svg>
    )
  }

  // Figura femenina: hombros más estrechos, cintura marcada y cadera más ancha
  return (
    <svg viewBox="0 0 100 190" role="img" aria-label={front ? 'Vista frontal' : 'Vista posterior'}>
      {head}
      <circle cx="31" cy="46" r="7" {...p('hombros')} />
      <circle cx="69" cy="46" r="7" {...p('hombros')} />
      {front ? (
        <>
          <rect x="35" y="42" width="14" height="17" rx="6" {...p('pecho')} />
          <rect x="51" y="42" width="14" height="17" rx="6" {...p('pecho')} />
          <rect x="40" y="62" width="20" height="28" rx="6" {...p('abdomen')} />
          <ellipse cx="50" cy="98" rx="20" ry="10" {...p('piernas')} />
          <rect x="31" y="102" width="17" height="80" rx="7" {...p('piernas')} />
          <rect x="52" y="102" width="17" height="80" rx="7" {...p('piernas')} />
        </>
      ) : (
        <>
          <rect x="35" y="42" width="30" height="38" rx="9" {...p('espalda')} />
          <ellipse cx="41" cy="96" rx="11" ry="13" {...p('piernas')} />
          <ellipse cx="59" cy="96" rx="11" ry="13" {...p('piernas')} />
          <rect x="31" y="106" width="17" height="76" rx="7" {...p('piernas')} />
          <rect x="52" y="106" width="17" height="76" rx="7" {...p('piernas')} />
        </>
      )}
      <rect x="19" y="54" width="8" height="40" rx="4" {...p('brazos')} />
      <rect x="73" y="54" width="8" height="40" rx="4" {...p('brazos')} />
    </svg>
  )
}

/** Muñecos con músculos pintados según porcentaje */
export function BodyMap({ pcts, max, only, compact }: {
  pcts: Record<string, number>; max: number; only?: 'front' | 'back'; compact?: boolean
}) {
  const female = useFemale()
  const fill = (g: G) => {
    const v = pcts[g] ?? 0
    return v > 0 ? `rgba(255,212,0,${0.3 + 0.7 * (v / max)})` : '#262626'
  }
  return (
    <div className={compact ? 'body-wrap compact' : 'body-wrap'}>
      {only !== 'back' && <figure><Fig view="front" female={female} fill={fill} /><figcaption>Frente</figcaption></figure>}
      {only !== 'front' && <figure><Fig view="back" female={female} fill={fill} /><figcaption>Espalda</figcaption></figure>}
    </div>
  )
}

/** Muñecos clicables para elegir un músculo */
export function BodyPicker({ value, onPick }: { value: G | null; onPick: (g: G | null) => void }) {
  const female = useFemale()
  const fill = (g: G) => (value === g ? '#ffd400' : '#2c2c2c')
  const on = (g: G) => ({
    onClick: () => onPick(value === g ? null : g),
    role: 'button',
    'aria-label': NAMES[g],
    style: { cursor: 'pointer' },
  })
  return (
    <div className="body-wrap picker">
      <figure><Fig view="front" female={female} fill={fill} on={on} /><figcaption>Frente</figcaption></figure>
      <figure><Fig view="back" female={female} fill={fill} on={on} /><figcaption>Espalda</figcaption></figure>
    </div>
  )
}