export const TERMS_VERSION = '3.4'
export const TERMS_DATE = '31 de octubre de 2026'
const OWNER = 'MioGym Technologies'
const EMAIL = 'miogym@gmail.com'
const LAW = 'Apizaco, Tlaxcala, México'

export interface Section { title: string; body: string[] }

export const TERMS: Section[] = [
  { title: '1. Aceptación', body: [
    `Estos Términos y condiciones regulan el uso de MioGym , ofrecida por ${OWNER}. Al crear una cuenta o usar la App declaras que los leíste y los aceptas.`,
    'Si no estás de acuerdo con alguna parte, no uses la App.' ] },
  { title: '2. Qué es MioGym', body: [
    'MioGym es una herramienta de apoyo para organizar tu entrenamiento, registrar tu alimentación y suplementos, recibir orientación sobre molestias físicas y seguir tu progreso.',
    'Todo el contenido es información general y educativa. No es un servicio médico, de nutrición, de fisioterapia ni de entrenamiento personal profesional.' ] },
  { title: '3. No es atención médica', body: [
    'La App no diagnostica enfermedades ni lesiones, y no sustituye la valoración de un médico, nutriólogo, fisioterapeuta u otro profesional de la salud.',
    'La evaluación de molestias es una orientación basada en lo que tú indicas y puede equivocarse. El bloqueo o ajuste de tus rutinas es una medida de prudencia; si decides cambiarlo, lo haces bajo tu responsabilidad.',
    'Las calorías, los macronutrientes y otras cifras son estimaciones aproximadas.',
    'Ante una emergencia (dolor de pecho, falta de aire importante, desmayo, pérdida de control de la orina o las heces, golpe fuerte, deformidad), llama a los servicios de emergencia de tu país (en México, 911) o acude a urgencias.' ] },
  { title: '4. Tu salud y tu responsabilidad', body: [
    'Antes de empezar o cambiar tu actividad física, alimentación o suplementos, consulta a un profesional de la salud, sobre todo si tienes una condición médica, estás embarazada o en lactancia, tomas medicamentos, tienes lesiones o antecedentes de trastornos de la conducta alimentaria.',
    'El ejercicio implica riesgos. Entrenas bajo tu propio riesgo. Detente si sientes dolor, mareo o malestar.',
    'Eres responsable de que los datos que registras sean verdaderos y estén actualizados, ya que las recomendaciones dependen de ellos.' ] },
  { title: '5. Edad', body: [
    'La App está pensada para personas de 18 años o más. Si eres menor de edad, solo puedes usarla con el conocimiento, el consentimiento y la supervisión de tu madre, padre o tutor.',
    'Para menores, algunas funciones se limitan.' ] },
  { title: '6. Tu cuenta', body: [
    'Debes proporcionar datos verdaderos y elegir una contraseña segura. Eres responsable de mantenerla confidencial y de la actividad realizada con tu cuenta.',
    `Si sospechas un uso no autorizado, avísanos de inmediato en ${EMAIL}.` ] },
  { title: '7. Tu contenido (fotos y datos)', body: [
    'Las fotos que subes y los datos que registras son tuyos. Por defecto son privados y solo tú los ves.',
    'Nos autorizas a almacenarlos y procesarlos únicamente para ofrecerte las funciones de la App.',
    'No subas contenido ilegal, ofensivo, ni imágenes de otras personas sin su permiso. No subas fotos de menores de edad que no sean tuyas.' ] },
  { title: '8. Datos personales y privacidad', body: [
    `El responsable del tratamiento de tus datos es ${OWNER}.`,
    'Datos que tratamos: de cuenta (correo y usuario); de perfil físico (edad o fecha de nacimiento, sexo, peso, altura, objetivo, experiencia); de salud (molestias, lesiones, medicación, condiciones, alergias); de hábitos (entrenamientos, comidas, suplementos, recordatorios); fotos y medidas corporales.',
    'Los datos de salud son sensibles. Los tratamos solo con tu consentimiento y solo para las funciones que usas: personalizar rutinas, nutrición y suplementos, y protegerte con avisos de seguridad.',
    'No vendemos tus datos personales.',
    'Usamos proveedores para operar la App: Supabase (autenticación, base de datos y almacenamiento de archivos). Si usas el análisis de fotos de comida con IA y pulsas "Analizar con IA", esa foto se envía a Google (Gemini) únicamente para estimar la comida. Si no lo pulsas, no se envía.',
    `Puedes pedir acceso, rectificación, cancelación o eliminación de tus datos, u oponerte a su tratamiento, escribiendo a ${EMAIL}.`,
    'Si usas el Asistente (chat), tu pregunta, la conversación reciente y un resumen de tus datos (edad, sexo, peso, altura, objetivo, entrenos, comidas, suplementos y molestias) se envían a Google (Gemini) para generar la respuesta. No se envían tus fotos ni tu correo. Puedes borrar tu conversación cuando quieras. Las respuestas las genera una IA, pueden contener errores y no sustituyen la valoración de un profesional de la salud.',
    'Conservamos tus datos mientras tengas cuenta. Aplicamos medidas de seguridad razonables, pero ningún sistema es completamente infalible.' ] },
  { title: '9. Nutrición y suplementos', body: [
    'Los planes de comida, las calorías y las valoraciones de un plato son aproximaciones y no reemplazan un plan elaborado por un nutriólogo o dietista.',
    'Si tienes alergias o intolerancias, revisa siempre los ingredientes y etiquetas de cada alimento o producto; la App puede no detectarlas todas.',
    'La información sobre suplementos es educativa. No recomendamos marcas ni productos concretos. Consulta a tu médico o farmacéutico antes de usarlos, sobre todo si tomas medicamentos, estás embarazada, o eres menor de edad.' ] },
  { title: '10. Rutinas y prevención de lesiones', body: [
    'Las rutinas se generan con reglas automáticas a partir de lo que indicas; no las diseñó un profesional para ti de forma individual.',
    'Las cargas, descansos y ejercicios sugeridos son orientativos. Aprende la técnica correcta y ajusta a cómo te sientes.',
    'La lista de ejercicios "sí", "con cuidado" y "evitar" según una molestia es una guía general y puede no ajustarse a tu caso.' ] },
  { title: '11. Recordatorios y notificaciones', body: [
    'Los recordatorios pueden fallar o no llegar. No dependas de ellos para asuntos de salud importantes.' ] },
  { title: '12. Uso aceptable', body: [
    'No uses la App para fines ilegales, ni intentes acceder a cuentas o datos de otras personas, vulnerar su seguridad, interferir con su funcionamiento, ni copiarla o revenderla.' ] },
  { title: '13. Propiedad intelectual', body: [
    `La App, su diseño, textos, código y marca son de ${OWNER} o de sus licenciantes. Te damos una licencia limitada, personal, no exclusiva y revocable para usarla conforme a estos términos.` ] },
  { title: '14. Disponibilidad y cambios del servicio', body: [
    'La App se ofrece "tal cual" y "según disponibilidad". Puede haber interrupciones, errores o cambios en sus funciones, y podemos modificarla o discontinuar partes de ella.' ] },
  { title: '15. Limitación de responsabilidad', body: [
    'En la medida permitida por la ley, no somos responsables por lesiones, daños a la salud, pérdidas o perjuicios derivados del uso de la App, de seguir o no sus recomendaciones, de errores en estimaciones, ni de fallos del servicio o de proveedores.',
    'Nada de lo anterior limita derechos o responsabilidades que la ley no permita limitar.' ] },
  { title: '16. Suspensión y eliminación de cuenta', body: [
    `Puedes dejar de usar la App cuando quieras y solicitar la eliminación de tu cuenta y tus datos en ${EMAIL}. Podemos suspender o cerrar cuentas que incumplan estos términos.` ] },
  { title: '17. Cambios a estos términos', body: [
    `Podemos actualizar estos términos. Indicaremos la versión y la fecha. Si el cambio es importante, te pediremos aceptarlos de nuevo para seguir usando la App.` ] },
  { title: '18. Ley aplicable y contacto', body: [
    `Estos términos se rigen por las leyes de ${LAW}. Para cualquier duda o solicitud, escribe a ${EMAIL}.` ] },
]