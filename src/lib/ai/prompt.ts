// Constructor del prompt del coach con las SIETE piezas en orden (sección 7).
// Es el corazón del producto: contexto completo, historial recortado, cifras
// solo de la cuenta del usuario y regla de idioma/tono.

import { COACH_SYSTEM } from "@/lib/ai/coachInstructions";
import { protocolSystemBlock, type ProtocolId } from "@/lib/ai/protocols";
import type { Message, Woman } from "@prisma/client";

export type TrimmedHistory = {
  lines: string[];
  lastHerLength?: number;
  lastSenderIsMe: boolean;
  missingTimes: boolean;
};

const TZ_DEFAULT = "America/Bogota";

function fmtDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("es", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// Recorte: 16 mensajes completos en modo normal, hasta 80 en análisis.
// Los viejos se recortan a su primera parte, no se borran del todo.
export function buildHistory(messages: Message[], mode: "normal" | "analisis", tz = TZ_DEFAULT): TrimmedHistory {
  const sorted = [...messages]
    .filter((m) => m.body.trim().length > 0)
    .sort((a, b) => (a.sentAt?.getTime() ?? 0) - (b.sentAt?.getTime() ?? 0));
  const keep = mode === "analisis" ? 80 : 16;
  const missingTimes = sorted.some((m) => !m.sentAt);
  const old = sorted.slice(0, Math.max(0, sorted.length - keep));
  const recent = sorted.slice(-keep);
  const lines: string[] = [];
  if (old.length > 0) {
    lines.push(`[Anterior: ${old.length} mensajes resumidos]`);
    for (const m of old.slice(-6)) {
      const who = m.sender === "me" ? "YO" : "ELLA";
      const when = m.sentAt ? fmtDate(m.sentAt, tz) : "(sin hora)";
      lines.push(`${who} [${when}]: ${m.body.slice(0, 40)}${m.body.length > 40 ? "…" : ""}`);
    }
  }
  for (const m of recent) {
    const who = m.sender === "me" ? "YO" : "ELLA";
    const when = m.sentAt ? fmtDate(m.sentAt, tz) : "(sin hora)";
    lines.push(`${who} [${when}]: ${m.body}`);
  }
  const last = sorted[sorted.length - 1];
  return {
    lines,
    lastHerLength: last && last.sender === "her" ? last.body.length : undefined,
    lastSenderIsMe: Boolean(last && last.sender === "me"),
    missingTimes,
  };
}

export type CoachContextInput = {
  woman: Woman;
  messages: Message[];
  userMessage: string;
  protocol: ProtocolId;
  protocolStep: number;
  stats: { mensajesEnviados: number; tasaRespuesta: number; citasConcretadas: number };
  tone?: string;
  lengthPref?: string;
  mode?: "normal" | "analisis";
  tz?: string;
  conversationStopped?: { stopped: boolean; motivo: string };
};

export function buildCoachMessages(input: CoachContextInput): Array<{ role: "system" | "user"; content: string }> {
  const tz = input.tz || TZ_DEFAULT;
  const now = fmtDate(new Date(), tz);
  const history = buildHistory(input.messages, input.mode || "normal", tz);

  const ficha = [
    `FICHA DE LA PERSONA (una sola; si el usuario habla de otra, pídele abrir una ficha aparte):`,
    `- Nombre: ${input.woman.name}`,
    input.woman.age ? `- Edad: ${input.woman.age}` : "",
    input.woman.city ? `- Ciudad: ${input.woman.city}` : "",
    input.woman.occupation ? `- Ocupación: ${input.woman.occupation}` : "",
    input.woman.archetype ? `- Perfil estimado: ${input.woman.archetype}` : "",
    `- Estado actual: ${input.woman.status} · Interés estimado: ${input.woman.interestLevel}/100 · Etapa: ${input.woman.stage}`,
    input.woman.metWhere ? `- Dónde se conocieron: ${input.woman.metWhere}` : "",
    input.woman.channel ? `- Canal del primer contacto: ${input.woman.channel}` : "",
    input.woman.notes ? `- Notas del usuario: ${input.woman.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const protocolBlock = protocolSystemBlock(input.protocol, input.protocolStep);

  const statsBlock = `DATOS MEDIDOS (solo de su cuenta; cítalos siempre con la marca "en tu cuenta"):
- Mensajes enviados: ${input.stats.mensajesEnviados}
- Tasa de respuesta de ella(s): ${input.stats.tasaRespuesta}%
- Citas concretadas: ${input.stats.citasConcretadas}
No existen otras cifras: si el usuario pide estadísticas de mercado, di que no hay datos y no inventes.`;

  const stopBlock = input.conversationStopped?.stopped
    ? `REGLA DE PARADA ACTIVA: ${input.conversationStopped.motivo} No escribas ningún [MENSAJE]; en [ACCION] indica parar y en [MENSAJE] escribe "SIN MENSAJE AHORA".`
    : "";

  const lastHerLength = history.lastHerLength;
  const lengthRule =
    input.lengthPref === "corta"
      ? "Preferencia del usuario: mensajes aún más breves de lo habitual."
      : "Preferencia del usuario: longitud estándar (una a dos líneas).";

  const system = [
    COACH_SYSTEM,
    stopBlock,
    lengthRule,
    input.tone ? `Tono por defecto del usuario: ${input.tone}. Ajústalo sin romper las reglas de longitud y de respeto.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const context = [
    `FECHA Y HORA ACTUAL DEL USUARIO: ${now} (zona horaria ${tz}). Úsala para calcular tiempos transcurridos; nunca digas que no sabes la fecha.`,
    ficha,
    protocolBlock,
    `HISTORIAL DE LA CONVERSACIÓN (YO = usuario, ELLA = la otra persona):`,
    history.lines.join("\n") || "(aún no hay mensajes registrados)",
    statsBlock,
    history.missingTimes
      ? "AVISO: hay mensajes sin hora en el historial. Menciónalo y pide completarlas: sin hora no se puede sugerir cuándo enviar."
      : "",
    history.lastSenderIsMe && !input.conversationStopped?.stopped
      ? "ATENCIÓN: el último mensaje es del USUARIO y ella no ha respondido todavía. NO propongas un segundo mensaje; propone esperar, un movimiento de presencia indirecta y el mensaje para después de que ella reaccione."
      : "",
    `Regla de idioma: responde exactamente en el idioma en el que escribe el usuario, sin mezclar.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: system },
    { role: "user", content: `${context}\n\nMENSAJE DEL USUARIO: ${input.userMessage}\n\nInstrucción final: responde SOLO con el formato de etiquetas [LECTURA] [ACCION] [MENSAJE] [HORA] [SI], sin markdown ni texto fuera de ellas.` },
  ];
}
