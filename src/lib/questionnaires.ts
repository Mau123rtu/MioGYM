import type { Profile } from '../context/AuthContext'

export type Answers = Record<string, any>
export const toArr = (v: any): string[] => (Array.isArray(v) ? v : v ? [v] : [])

export interface Field { id: string; label: string; kind: 'text' | 'select'; options?: [string, string][]; when: string[] }
export interface Q {
  id: string
  title: string
  hint?: string
  hintFn?: (p: Profile | null) => string
  type: 'single' | 'multi' | 'confirm' | 'text'
  options?: [string, string][]
  exclusive?: string
  placeholder?: string
  showIf?: (a: Answers) => boolean
  follow?: Field[]
}
export interface Config {
  slug: string
  db: 'rutinas' | 'nutricion' | 'lesiones' | 'suplementos'
  title: string
  defaults?: (p: Profile | null) => Answers
  questions: Q[]
}

const yn: [string, string][] = [['no', 'No'], ['si', 'Sí']]
const ynd: [string, string][] = [['no', 'No'], ['si', 'Sí'], ['nose', 'No estoy seguro']]

/* ---------- RUTINAS ---------- */
const rutinas: Config = {
  slug: 'ejercicios', db: 'rutinas', title: 'Perfil de rutinas',
  questions: [
    { id: 'confirmar', type: 'confirm', title: 'Confirma tus datos',
      hint: 'Estos datos vienen de tu perfil inicial. Si algo cambió, puedes continuar y ajustarlo después.' },
    { id: 'tipo', type: 'single', title: '¿Qué tipo de entrenamiento te interesa realizar?', options: [
      ['hipertrofia', 'Hipertrofia muscular'], ['fuerza', 'Fuerza'], ['resistencia', 'Resistencia muscular'],
      ['calistenia', 'Calistenia'], ['funcional', 'Entrenamiento funcional'], ['combinacion', 'Una combinación de varios']] },
    { id: 'grupos', type: 'multi', exclusive: 'todo', title: '¿Qué grupos musculares quieres priorizar?', hint: 'Puedes elegir varios.', options: [
      ['pecho', 'Pecho'], ['espalda', 'Espalda'], ['hombros', 'Hombros'], ['brazos', 'Bíceps y tríceps'],
      ['piernas', 'Piernas y glúteos'], ['abdomen', 'Abdomen'], ['todo', 'Todo el cuerpo por igual']] },
    { id: 'tiempo', type: 'single', title: '¿Cuánto tiempo puedes dedicar a cada sesión?', options: [
      ['20-30', '20–30 minutos'], ['30-45', '30–45 minutos'], ['45-60', '45–60 minutos'],
      ['60-90', '60–90 minutos'], ['90+', 'Más de 90 minutos']] },
    { id: 'equipo', type: 'multi', title: '¿Qué equipo tienes disponible?', options: [
      ['maquinas', 'Máquinas de gimnasio'], ['libres', 'Mancuernas y barras'], ['poleas', 'Poleas'],
      ['bandas', 'Bandas elásticas'], ['corporal', 'Solo peso corporal'], ['otro', 'Otro equipo']],
      hintFn: p => ({
        gimnasio: 'Registraste que entrenas en gimnasio: normalmente tendrás máquinas, poleas y pesas libres.',
        casa: 'Registraste que entrenas en casa: el peso corporal y las bandas son una excelente base.',
        casa_basico: 'Registraste casa con equipo básico: mancuernas y bandas suelen ser suficientes.',
        aire_libre: 'Registraste que entrenas al aire libre: peso corporal y bandas son lo más práctico.',
      } as Record<string, string>)[p?.training_place ?? ''] ?? 'Puedes elegir varias opciones.' },
    { id: 'estructura', type: 'single', title: '¿Cómo prefieres organizar tus entrenamientos?', options: [
      ['cuerpo', 'Cuerpo completo'], ['sup_inf', 'Tren superior e inferior'], ['grupo', 'Un grupo muscular por sesión'],
      ['ppl', 'Empuje, tirón y piernas (PPL)'], ['auto', 'No lo sé; que la aplicación lo elija']] },
    { id: 'tiempo_entrenando', type: 'single', title: '¿Cuánto tiempo llevas entrenando de forma constante?', options: [
      ['nunca', 'Todavía no he comenzado'], ['menos6', 'Menos de 6 meses'], ['6m-2a', 'De 6 meses a 2 años'],
      ['2-5', 'De 2 a 5 años'], ['mas5', 'Más de 5 años']] },
    { id: 'estilo', type: 'single', title: '¿Cómo te gusta entrenar?', hint: 'Es una preferencia, no una medida de la intensidad segura para ti.', options: [
      ['cortas', 'Prefiero sesiones cortas e intensas'], ['moderadas', 'Prefiero sesiones moderadas'],
      ['largas', 'Prefiero sesiones largas con más ejercicios'], ['ninguna', 'No tengo preferencia']] },
    { id: 'recuperacion', type: 'single', title: '¿Cómo describirías tu recuperación entre entrenamientos?', options: [
      ['bien', 'Normalmente me recupero bien'], ['a_veces', 'A veces sigo fatigado o adolorido'],
      ['agotado', 'Frecuentemente me siento agotado'], ['nose', 'No lo sé todavía']] },
  ],
}

/* ---------- NUTRICIÓN ---------- */
const nutricion: Config = {
  slug: 'nutricion', db: 'nutricion', title: 'Perfil nutricional',
  defaults: p => ({ objetivo: ({ masa: 'masa', grasa: 'grasa', fuerza: 'rendimiento', condicion: 'habitos', saludable: 'mantener' } as Record<string, string>)[p?.goal ?? ''] }),
  questions: [
    { id: 'objetivo', type: 'single', title: '¿Qué quieres conseguir con tu alimentación?', hint: 'Lo preseleccionamos según tu objetivo del perfil inicial.', options: [
      ['masa', 'Ganar masa muscular'], ['grasa', 'Perder grasa corporal'], ['mantener', 'Mantener mi peso'],
      ['habitos', 'Mejorar mis hábitos alimentarios'], ['rendimiento', 'Apoyar mi rendimiento deportivo']] },
    { id: 'alimentacion', type: 'single', title: '¿Cómo describirías tu alimentación actual?', options: [
      ['equilibrada', 'Como de manera equilibrada'], ['irregular', 'Como a horarios irregulares'],
      ['rapida', 'Consumo frecuentemente comida preparada o rápida'], ['sin_rutina', 'No tengo una rutina alimentaria'],
      ['mejorando', 'Estoy intentando mejorar mis hábitos']] },
    { id: 'comidas', type: 'single', title: '¿Cuántas comidas sueles hacer al día?', options: [
      ['1-2', '1–2'], ['3', '3'], ['4', '4'], ['5+', '5 o más'], ['variable', 'Mi horario cambia cada día']] },
    { id: 'dieta', type: 'single', title: '¿Qué tipo de alimentación prefieres?', options: [
      ['omnivora', 'Omnívora'], ['vegetariana', 'Vegetariana'], ['vegana', 'Vegana'], ['otra', 'Otra preferencia'], ['ninguna', 'Sin preferencias específicas']],
      follow: [{ id: 'dieta_otra', label: '¿Cuál?', kind: 'text', when: ['otra'] }] },
    { id: 'alergias', type: 'single', title: '¿Tienes alergias, intolerancias o alimentos que debamos evitar?', options: ynd,
      follow: [
        { id: 'alergias_tipo', label: 'Tipo', kind: 'select', when: ['si'], options: [['alergia', 'Alergia'], ['intolerancia', 'Intolerancia'], ['preferencia', 'Preferencia (no quiero comerlo)']] },
        { id: 'alergias_detalle', label: '¿Cuáles alimentos?', kind: 'text', when: ['si'] }] },
    { id: 'presupuesto', type: 'single', title: '¿Cuál es tu presupuesto aproximado para alimentación?', options: [
      ['ajustado', 'Ajustado'], ['moderado', 'Moderado'], ['flexible', 'Flexible'], ['cantidad', 'Prefiero introducir una cantidad']],
      follow: [
        { id: 'pres_monto', label: 'Cantidad', kind: 'text', when: ['cantidad'] },
        { id: 'pres_moneda', label: 'Moneda (ej. MXN)', kind: 'text', when: ['cantidad'] },
        { id: 'pres_periodo', label: 'Periodo', kind: 'select', when: ['cantidad'], options: [['diario', 'Diario'], ['semanal', 'Semanal']] },
        { id: 'pres_personas', label: '¿Para cuántas personas cocinas?', kind: 'text', when: ['cantidad'] }] },
    { id: 'tiempo', type: 'single', title: '¿Cuánto tiempo tienes para preparar tus comidas?', options: [
      ['<15', 'Menos de 15 minutos'], ['15-30', '15–30 minutos'], ['>30', 'Más de 30 minutos'],
      ['lotes', 'Prefiero cocinar para varios días'], ['fuera', 'Normalmente como fuera de casa']] },
    { id: 'agua', type: 'single', title: '¿Cuánta agua bebes habitualmente al día?', hint: 'Es una estimación inicial.', options: [
      ['<1', 'Menos de 1 litro'], ['1-2', 'Entre 1 y 2 litros'], ['2-3', 'Entre 2 y 3 litros'], ['>3', 'Más de 3 litros'], ['nose', 'No lo sé']] },
    { id: 'condicion', type: 'single', title: '¿Hay alguna condición o indicación profesional que debamos considerar en tu alimentación?',
      hint: 'Es información de salud: se guarda de forma privada.', options: [['no', 'No'], ['si', 'Sí'], ['despues', 'Prefiero responder después']],
      follow: [{ id: 'condicion_detalle', label: 'Solo lo necesario (ej. dieta prescrita o restricción médica)', kind: 'text', when: ['si'] }] },
  ],
}

/* ---------- LESIONES ---------- */
const lesiones: Config = {
  slug: 'lesiones', db: 'lesiones', title: 'Perfil de prevención',
  questions: [
    { id: 'alarma', type: 'single', title: '¿Has tenido dolor en el pecho, desmayos o dificultad importante para respirar al ejercitarte?',
      hint: 'Si es así, detén el ejercicio y busca atención médica urgente.', options: yn },
    { id: 'dolor', type: 'single', title: '¿Tienes actualmente alguna lesión, dolor o molestia física?', options: ynd,
      follow: [
        { id: 'intensidad', label: '¿Qué tan intenso es?', kind: 'select', when: ['si'], options: [['leve', 'Leve'], ['moderado', 'Moderado'], ['intenso', 'Intenso']] },
        { id: 'evaluada', label: '¿Te ha evaluado un profesional sanitario?', kind: 'select', when: ['si'], options: [['si', 'Sí'], ['no', 'No']] }] },
    { id: 'zonas', type: 'multi', title: '¿En qué zona tienes la molestia o lesión?', hint: 'Puedes elegir varias.',
      showIf: a => a.dolor === 'si', options: [
        ['cuello', 'Cuello'], ['hombro', 'Hombro'], ['codo', 'Codo o muñeca'], ['espalda', 'Espalda'],
        ['cadera', 'Cadera'], ['rodilla', 'Rodilla'], ['tobillo', 'Tobillo o pie'], ['otra', 'Otra zona']] },
    { id: 'situaciones', type: 'multi', title: '¿Qué situaciones provocan o empeoran la molestia?',
      hint: 'Solo para adaptar recomendaciones; no diagnostica.', showIf: a => a.dolor === 'si', options: [
        ['peso', 'Levantar peso'], ['encima', 'Movimientos por encima de la cabeza'], ['flexion', 'Flexionar o extender una articulación'],
        ['impacto', 'Caminar, correr o saltar'], ['reposo', 'También me duele en reposo'], ['nose', 'No lo sé']] },
    { id: 'previas', type: 'single', title: '¿Has tenido lesiones anteriores que afecten tu entrenamiento actual?', options: [
      ['no', 'No'], ['recuperado', 'Sí, ya estoy recuperado'], ['limitaciones', 'Sí, todavía tengo limitaciones'], ['despues', 'Prefiero responder después']],
      follow: [{ id: 'restricciones', label: 'Restricciones conocidas o recomendaciones recibidas', kind: 'text', when: ['limitaciones'] }] },
    { id: 'indicaciones', type: 'single', title: '¿Has recibido indicaciones profesionales para evitar ciertos movimientos o ejercicios?', options: ynd,
      follow: [{ id: 'indicaciones_detalle', label: '¿Cuáles?', kind: 'text', when: ['si'] }] },
    { id: 'calentamiento', type: 'single', title: '¿Qué haces normalmente antes de comenzar a entrenar?', options: [
      ['completo', 'Calentamiento general y específico'], ['ligero', 'Unos minutos de actividad ligera'],
      ['directo', 'Comienzo directamente con los ejercicios'], ['ninguno', 'No tengo una rutina de calentamiento']] },
    { id: 'mejorar', type: 'multi', exclusive: 'todo', title: '¿Qué te gustaría mejorar para entrenar de forma más segura?', options: [
      ['tecnica', 'Aprender la técnica correcta'], ['movilidad', 'Mejorar mi movilidad'], ['calentar', 'Aprender a calentar'],
      ['cargas', 'Saber cuándo aumentar las cargas'], ['errores', 'Evitar errores frecuentes'], ['todo', 'Todo lo anterior']] },
  ],
}

/* ---------- SUPLEMENTOS ---------- */
const suplementos: Config = {
  slug: 'suplementos', db: 'suplementos', title: 'Perfil de suplementos',
  questions: [
    { id: 'actuales', type: 'multi', exclusive: 'ninguno', title: '¿Actualmente consumes algún suplemento?', hint: 'Puedes elegir varios.', options: [
      ['ninguno', 'No consumo suplementos'], ['proteina', 'Proteína en polvo'], ['creatina', 'Creatina'],
      ['cafeina', 'Cafeína o preentrenamiento'], ['vitaminas', 'Vitaminas o minerales'], ['otros', 'Otros suplementos']],
      follow: [{ id: 'otros_detalle', label: '¿Cuáles otros?', kind: 'text', when: ['otros'] }] },
    { id: 'objetivo', type: 'single', title: '¿Qué quieres conseguir con la suplementación?', options: [
      ['complementar', 'Complementar mi alimentación'], ['musculo', 'Apoyar el desarrollo muscular'], ['rendimiento', 'Mejorar mi rendimiento'],
      ['recuperacion', 'Apoyar mi recuperación'], ['evidencia', 'Conocer los suplementos con evidencia científica'], ['nose', 'No sé cuáles podrían ser adecuados para mí']] },
    { id: 'detalle', type: 'text', title: '¿Qué suplemento consumes y en qué cantidad?',
      hint: 'Opcional. Indica nombre y marca, cantidad por toma, frecuencia y desde cuándo. Puedes escribir "no sé la dosis".',
      placeholder: 'Ej. Creatina monohidratada (marca X), 5 g, diario, 3 meses',
      showIf: a => toArr(a.actuales).length > 0 && !toArr(a.actuales).includes('ninguno') },
    { id: 'medicacion', type: 'single', title: '¿Tomas medicamentos o tienes alguna indicación médica que pueda afectar la seguridad de los suplementos?',
      hint: 'Pregunta sensible y opcional.', options: [['no', 'No'], ['si', 'Sí'], ['prefiero_no', 'Prefiero no responder']] },
    { id: 'presupuesto', type: 'single', title: '¿Qué presupuesto mensual destinarías a suplementos?', options: [
      ['ninguno', 'Ninguno'], ['bajo', 'Bajo'], ['moderado', 'Moderado'], ['flexible', 'Flexible'], ['cantidad', 'Quiero introducir una cantidad']],
      follow: [{ id: 'pres_monto', label: 'Cantidad mensual y moneda', kind: 'text', when: ['cantidad'] }] },
    { id: 'info', type: 'multi', title: '¿Qué información te interesa conocer sobre cada suplemento?', hint: 'Puedes elegir varias.', options: [
      ['evidencia', 'Beneficios y evidencia científica'], ['riesgos', 'Posibles riesgos y contraindicaciones'],
      ['dosis', 'Dosis estudiadas y forma de uso'], ['etiquetas', 'Cómo interpretar las etiquetas'], ['precios', 'Comparación de precios y productos']] },
    { id: 'restricciones', type: 'multi', exclusive: 'ninguna', title: '¿Tienes alguna preferencia o restricción sobre los productos?', options: [
      ['vegano', 'Prefiero productos sin ingredientes de origen animal'], ['alergias', 'Necesito considerar alergias o intolerancias'],
      ['certificacion', 'Busco productos con certificación independiente de calidad'], ['ninguna', 'No tengo preferencias'], ['otra', 'Otra']],
      follow: [
        { id: 'alergias_detalle', label: '¿A qué eres alérgico o intolerante?', kind: 'text', when: ['alergias'] },
        { id: 'otra_detalle', label: '¿Cuál otra?', kind: 'text', when: ['otra'] }] },
  ],
}

export const CONFIGS: Record<string, Config> = { ejercicios: rutinas, nutricion, lesiones, suplementos }