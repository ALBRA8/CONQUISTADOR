// Medallas automáticas por hitos reales medibles en la base de datos.
// Las que requieren evidencia subjetiva se verifican con IA (verificador 8.7).

import { db } from "@/lib/db";

export const AUTO_CODES: Record<string, string> = {
  primera_ficha: "Primera ficha creada",
  primera_radiografia: "Primera radiografía",
  primera_cita_agendada: "Primera cita agendada",
  primera_cita_hecha: "Primera cita hecha",
  primer_mensaje_respondido: "Primer mensaje enviado y respondido",
};

export async function grantAuto(userId: string, code: string) {
  const title = AUTO_CODES[code];
  if (!title) return false;
  const exists = await db.achievement.findUnique({ where: { userId_code: { userId, code } } });
  if (exists) return false;
  await db.achievement.create({
    data: { userId, code, title, verifiedByAi: false, claimedAt: new Date(), verifiedAt: new Date() },
  });
  return true;
}

export async function hasAchievement(userId: string, code: string) {
  const a = await db.achievement.findUnique({ where: { userId_code: { userId, code } } });
  return Boolean(a);
}

// Detecta el logro "primer mensaje enviado y respondido": existe una sugerencia
// marcada como enviada y después llegó un mensaje de ella.
export async function checkFirstMessageResponded(userId: string) {
  if (await hasAchievement(userId, "primer_mensaje_respondido")) return;
  const suggestions = await db.suggestion.findMany({
    where: { sentAt: { not: null }, woman: { userId } },
    include: { woman: true },
  });
  for (const s of suggestions) {
    if (!s.sentAt) continue;
    const herReply = await db.message.findFirst({
      where: { womanId: s.womanId, sender: "her", sentAt: { gt: s.sentAt } },
    });
    if (herReply) {
      await grantAuto(userId, "primer_mensaje_respondido");
      return;
    }
  }
}
