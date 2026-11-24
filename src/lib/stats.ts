// Métricas propias del usuario: los ÚNICOS números que la app puede mostrar
// como "medidos" (sección 11). Siempre etiquetados "medido en tu cuenta".

import { db } from "@/lib/db";

export type UserStats = {
  mensajesEnviados: number;
  mensajesRecibidos: number;
  tasaRespuesta: number; // % de conversaciones donde ella respondió después del último mensaje propio
  tiempoMedioRespuestaElla: number | null; // minutos
  diasActivo: number;
  citasPropuestas: number;
  citasHechas: number;
};

export async function computeUserStats(userId: string): Promise<UserStats> {
  const women = await db.woman.findMany({
    where: { userId, archivedAt: null },
    include: { messages: true, dates: true },
  });

  let enviados = 0;
  let recibidos = 0;
  let conRespuesta = 0;
  let conversacionesConMensajes = 0;
  const responseTimes: number[] = [];
  const activeDays = new Set<string>();

  for (const w of women) {
    const msgs = w.messages
      .filter((m) => m.sentAt)
      .sort((a, b) => (a.sentAt!.getTime() ?? 0) - (b.sentAt!.getTime() ?? 0));
    if (msgs.length === 0) continue;
    conversacionesConMensajes++;
    let lastMe: { at: Date; answered: boolean } | null = null;
    for (const m of msgs) {
      const day = m.sentAt!.toISOString().slice(0, 10);
      activeDays.add(day);
      if (m.sender === "me") {
        enviados++;
        lastMe = { at: m.sentAt!, answered: false };
      } else {
        recibidos++;
        if (lastMe && !lastMe.answered) {
          const mins = (m.sentAt!.getTime() - lastMe.at.getTime()) / 60000;
          if (mins > 0 && mins < 60 * 24 * 14) responseTimes.push(mins);
          lastMe.answered = true;
        }
      }
    }
    if (lastMe?.answered) conRespuesta++;
  }

  const citasPropuestas = women.reduce(
    (acc, w) => acc + w.dates.filter((d) => d.status === "agendada" || d.status === "hecha" || d.status === "no_show").length,
    0
  );
  const citasHechas = women.reduce((acc, w) => acc + w.dates.filter((d) => d.status === "hecha").length, 0);

  return {
    mensajesEnviados: enviados,
    mensajesRecibidos: recibidos,
    tasaRespuesta: conversacionesConMensajes > 0 ? Math.round((conRespuesta / conversacionesConMensajes) * 100) : 0,
    tiempoMedioRespuestaElla:
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null,
    diasActivo: activeDays.size,
    citasPropuestas,
    citasHechas,
  };
}
