// Moderador de contenido y reglas de parada (secciones 2.3, 8.8 y 9.9).
// Dos capas: una local (regex, rápida, sin IA) y una por IA opcional.

export type ModerationVerdict = {
  viola: boolean;
  parar: boolean;
  tipo: string;
  motivo: string;
};

const INSULT_PATTERNS: RegExp[] = [
  /\b(perra|zorra|puta|cabeza hueca|idiota|est[uú]pida|in[uú]til|fea|gorda)\b/i,
  /\b(todas (las mujeres|ellas) (son|piensan|hacen)|las mujeres (son|piensan))\b/i,
];

const COERCION_PATTERNS: RegExp[] = [
  /\b(si no (me )?(contesta|responde)s? (voy a|te voy a|va a pasar)|voy a (ir|aparecer) (a|por) (tu )?casa|te voy a buscar|sabr[eé] (d[oó]nde|con qui[eé]n))\b/i,
  /\b(no me importa que (digas que )?no|igual (te voy a|vas a)|voy a (seguir|insistir) hasta)\b/i,
  /\b(te (voy a )?(arruinar|hacer da[nñ]o|denunciar)|vengarse|desquitarme)\b/i,
];

const MINORS_PATTERNS: RegExp[] = [
  /\b(menor de edad|es menor|tiene 1[0-7] a[nñ]os|colegio|secundaria|prepa)\b.*\b(cita|salir|ligar|conquistar|enviar|mensaje)\b/i,
  /\b(1[0-7] a[nñ]os)\b/i,
];

const HARASSMENT_PATTERNS: RegExp[] = [
  /\b(deja (de )?(escribirme|mandar mensajes|buscar)|no me escribas|no quiero saber de ti|bloqu[eé]a(te)?|te voy a bloquear|pide (que )?(espacio|distancia))\b/i,
];

// Señales de rechazo de ELLA en el historial → regla de parada del coach
const REJECTION_PATTERNS: RegExp[] = [
  /\b(no (gracias|me interesa|me gusta|quiero|insistas|te (quiero|puedo) ver)|no gracias)\b/i,
  /\b(deja de escribir|no me escribas|m[eé]jate|no insistas|no insista)\b/i,
  /\b(me incomoda|no me siento c[oó]moda|para por favor|basta)\b/i,
  /\b(tengo novio|estoy con alguien|no estoy (interesada|lista))\b/i,
];

export function localModerate(text: string): ModerationVerdict {
  const t = text.toLowerCase();
  for (const re of MINORS_PATTERNS) {
    if (re.test(text)) {
      return { viola: true, parar: true, tipo: "menores", motivo: "La conversación menciona a alguien que podría ser menor de edad. No se continúa." };
    }
  }
  for (const re of COERCION_PATTERNS) {
    if (re.test(text)) {
      return { viola: true, parar: true, tipo: "coercion", motivo: "Hay señales de coerción o amenaza. Eso no se escribe ni se valida." };
    }
  }
  for (const re of HARASSMENT_PATTERNS) {
    if (re.test(text)) {
      return { viola: true, parar: true, tipo: "insistencia", motivo: "La otra persona pidió parar o espacio. Se respeta y se detiene el hilo." };
    }
  }
  for (const re of INSULT_PATTERNS) {
    if (re.test(text)) {
      return { viola: true, parar: true, tipo: "agresividad", motivo: "Hay insultos o descalificaciones. Así no se trata a nadie." };
    }
  }
  return { viola: false, parar: false, tipo: "ninguno", motivo: "" };
}

export function detectRejection(text: string): boolean {
  return REJECTION_PATTERNS.some((re) => re.test(text));
}

// Escanea los últimos mensajes de ELLA buscando rechazos o límites claros
export function conversationStopped(herLastMessages: string[]): { stopped: boolean; motivo: string } {
  for (const m of herLastMessages) {
    if (detectRejection(m)) {
      return {
        stopped: true,
        motivo: "En el historial hay un no claro o señales de incomodidad. El coach deja de proponer mensajes: se para aquí y se respeta.",
      };
    }
  }
  return { stopped: false, motivo: "" };
}

export const STOP_CARD_TEXT =
  "Aquí se para. Hay un límite claro en la conversación y respetarlo no es negociable. No se propone ningún mensaje: lo correcto es dejar de escribir, y si en el futuro ella retoma el contacto por su cuenta, se conversará entonces.";
