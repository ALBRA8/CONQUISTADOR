// Detector de protocolo: NO es IA. Expresiones regulares bilingües sobre el
// mensaje del usuario (sección 10 del encargo). Decide qué protocolo inyectar.

export type ProtocolId = "none" | "reactivar" | "invitar" | "entender" | "diagnostico";

const PATTERNS: Array<{ id: Exclude<ProtocolId, "none">; re: RegExp }> = [
  {
    id: "reactivar",
    re: /\b(visto|me dej[óo] (en )?visto|no (me )?contesta|no (me )?responde|me ignor|ghost|left me on read|no contesta|sigo en visto|silencio)\b/i,
  },
  {
    id: "invitar",
    re: /\b(invitar|invitarla|invitarl[ae]|pedirle (una )?cita|salir (con ella|juntos)|ask her out|proponer (un plan|salir|una cita)|pedir (una )?cita|verla en persona|concretar)\b/i,
  },
  {
    id: "entender",
    re: /\b(no entiendo|no la entiendo|por qu[eé] las mujeres|why (do )?women|c[oó]mo (funcionan|piensan) las mujeres|no las entiendo|que quieren las mujeres)\b/i,
  },
  {
    id: "diagnostico",
    re: /\b(diagn[oó]stico|plan de 30|30\/60\/90|30-60-90|necesito mejorar|eval[uú]a(me)?|mi nivel|plan personal)\b/i,
  },
];

export function detectProtocol(userMessage: string): ProtocolId {
  for (const p of PATTERNS) {
    if (p.re.test(userMessage)) return p.id;
  }
  return "none";
}

// Pasos de cada protocolo, redacción propia (sección 10). Nunca se muestra el
// nombre del protocolo en la interfaz; aquí vive como dato interno.
export const PROTOCOL_STEPS: Record<Exclude<ProtocolId, "none">, string[]> = {
  reactivar: [
    "Antes de cualquier mensaje: si el silencio lleva MENOS de 24 horas y la conversación no estaba fría, di claramente que aún no es un silencio real y que no se escriba nada todavía.",
    "Reúne el contexto obligatorio (pregunta como máximo 3 por turno hasta completarlas): dónde se conocieron; cuánto tiempo llevan hablando y con qué frecuencia; si se han visto en persona; cuánto lleva sin responder y si lo vio; cómo iba la conversación justo antes de enfriarse. Está PROHIBIDO dar un mensaje antes de tener estas respuestas.",
    "Calibra con tres números que le pidas al usuario: qué tan atractiva la considera él (1-10), su propia confianza (1-10) y su experiencia previa con esto. Si ella es muy atractiva para él, él va sin experiencia y no se han visto, nómbrale la hipótesis más probable: invirtió demasiado pronto.",
    "Pide las últimas 10-15 líneas del chat y clasifica cuál fue SU último mensaje: pregunta genérica, mensaje largo, halago, saludo vacío, insinuación temprana, o ligero con espacio.",
    "Solo entonces escribe el mensaje en [MENSAJE], con la regla de oro: el primer mensaje NO revela lo que se vio del perfil; construye curiosidad. Cierra con el plan fijo: enviar y soltar; mientras espera, abrir conversaciones con otras personas; si responde o pasan 5-7 días, volver y contarlo. Si no responde, NO se manda otro.",
  ],
  invitar: [
    "Fase de contexto: cómo se conocieron, cuánto llevan hablando y por qué canal.",
    "Mide el interés con las 8 señales: ¿ella preguntaba por su cuenta o solo respondía? ¿la conversación se sostenía sola? ¿reía o respondía seco? ¿retomaba temas? ¿compartía cosas personales? ¿respondía rápido? ¿propuso ella algún tema de encuentro? ¿menciona planes o disponibilidad? Puntúa 1-4: aún no; 5-7: seguir construyendo; 8-10: se puede acelerar sin saltar fases.",
    "Averigua disponibilidad y plan: qué se sabe de sus horarios, qué plan encaja con lo que les gusta a ambos, qué logística falta (lugar, día, distancia).",
    "Comprueba las cinco condiciones en voz alta: interés suficiente, conversación fluida, conexión real, logística clara y pre-validación positiva. Si falta alguna, di cuál y cómo construirla antes de invitar.",
    "Prepara el terreno: cómo dejar el plan flotando en la conversación sin pedir nada todavía.",
    "Pre-validación: da 2 comentarios de ejemplo que dejen el plan flotando sin pedir nada (tipo 'ese sitio habría que probarlo').",
    "Redacta la invitación como PLAN, no como pregunta: estructura 'tenemos que resolver esto, te llevo a X, ¿te queda mejor A o B?' con DOS opciones de día, nunca una sola.",
    "Da el mensaje final en [MENSAJE] con longitud y hora sugerida.",
    "Recuerda la confirmación: muchas citas se caen porque nadie confirmó. Indica recordar el mismo día y qué mensaje de confirmación usar.",
    "Vigila el contador: si el usuario ya lleva ~25-30 mensajes propios en el hilo sin invitar, díselo con SU número ('en tu cuenta llevas N') y empuja a concretar.",
  ],
  entender: [
    "Empieza aceptando el marco: esto no garantiza resultados, no da permiso para acosar ni presionar, y ante incomodidad o límites claros de la otra persona, se para. Pide al usuario que confirme que lo acepta antes de seguir.",
    "Pide contexto concreto de SU situación (máximo 3 preguntas por turno): con quién, cómo va, qué le confunde exactamente.",
    "Lee señales CON él sobre esa conversación concreta: qué muestras de interés o desinterés hay en el historial y qué significan.",
    "Cierra con qué hacer según lo que ella muestre, hablando siempre de esta persona y este contexto, nunca de 'las mujeres' en general.",
  ],
  diagnostico: [
    "Pide al usuario que puntúe del 1 al 10 sus siete áreas: resultados con mujeres, físico y salud, imagen y presencia, desarrollo profesional, vida social, mentalidad y hábitos, presencia digital.",
    "Calcula el promedio como nivel global y nómbralo con una banda propia (una palabra o dos).",
    "Entrega el plan por semanas (JSON de la función de diagnóstico si la app lo pide) con acciones medibles y una fecha de revisión a 15 días.",
    "Dile que guarde el documento: sin él no se podrá comparar el avance la próxima vez.",
  ],
};

export function protocolSystemBlock(protocol: ProtocolId, step: number): string {
  if (protocol === "none") return "";
  const steps = PROTOCOL_STEPS[protocol];
  const current = steps[Math.min(step, steps.length - 1)];
  return `MODO DE TRABAJO ACTIVO (se aplica sin anunciarlo ni nombrarlo):
Estás siguiendo un procedimiento por fases para el caso actual. Reglas duras:
1. NO entregues ningún mensaje en [MENSAJE] hasta completar las fases previas requeridas por el procedimiento.
2. En este turno te toca trabajar SOLO la fase ${Math.min(step + 1, steps.length)} de ${steps.length}: "${current}"
3. Si el usuario se apura, responde que sin el contexto completo el mensaje saldría genérico y no serviría.
4. Avanza de fase solo cuando tengas lo que la fase exige; si ya lo tienes del contexto, avanza tú mismo y dilo.
5. Al completar todas las fases, entrega el mensaje final con el formato completo de salida.
6. Termina SIEMPRE tu respuesta con una línea [FASE n] donde n es el número de fase en la que quedas (si la completaste, n+1; máximo ${steps.length}).`;
}

export const PROTOCOL_TOTAL_STEPS: Record<Exclude<ProtocolId, "none">, number> = {
  reactivar: 5,
  invitar: 10,
  entender: 4,
  diagnostico: 4,
};
