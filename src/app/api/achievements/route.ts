import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiHelpers";

// Medallas y niveles (7 niveles con nombres propios, sección 6.11)
export const LEVELS = [
  { min: 0, name: "Arranque" },
  { min: 1, name: "Primer Latido" },
  { min: 3, name: "Ritmo" },
  { min: 6, name: "Compás" },
  { min: 10, name: "Sobremesa" },
  { min: 16, name: "Mesa Dos" },
  { min: 25, name: "Pulso Firme" },
];

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;

  const [achievements, womenCount, datesDone, sentAndAnswered] = await Promise.all([
    db.achievement.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: "asc" } }),
    db.woman.count({ where: { userId: auth.user.id } }),
    db.dateEntry.count({ where: { woman: { userId: auth.user.id }, status: "hecha" } }),
    db.suggestion.count({ where: { woman: { userId: auth.user.id }, sentAt: { not: null } } }),
  ]);

  const score = womenCount + datesDone * 2 + sentAndAnswered;
  const level = [...LEVELS].reverse().find((l) => score >= l.min) || LEVELS[0];

  return NextResponse.json({
    achievements,
    level: { name: level.name, score, next: LEVELS.find((l) => l.min > score) || null },
    counters: { fichas: womenCount, citasHechas: datesDone, mensajesEnviados: sentAndAnswered },
  });
}

// Reclamar una medalla con evidencia (verificada con IA)
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as
    | { code?: string; title?: string; evidence?: string }
    | null;
  if (!body?.code || !body?.evidence) {
    return NextResponse.json({ error: "Falta el código o la evidencia del logro." }, { status: 400 });
  }

  // Verificación con IA dentro del flujo de /api/ai para respetar cuota:
  // aquí solo persistimos la reclamación pendiente; el cliente llama a /api/ai action=achievement_verify
  const claimed = await db.achievement.upsert({
    where: { userId_code: { userId: auth.user.id, code: body.code } },
    create: {
      userId: auth.user.id,
      code: body.code,
      title: body.title || body.code,
      evidenceText: body.evidence.slice(0, 2000),
      claimedAt: new Date(),
      verifiedByAi: false,
    },
    update: { evidenceText: body.evidence.slice(0, 2000), claimedAt: new Date() },
  });
  return NextResponse.json({ achievement: claimed });
}

// Confirmar la verificación de IA tras el paso por /api/ai
export async function PUT(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as { code?: string; verified?: boolean } | null;
  if (!body?.code) return NextResponse.json({ error: "Falta el código." }, { status: 400 });
  const existing = await db.achievement.findUnique({
    where: { userId_code: { userId: auth.user.id, code: body.code } },
  });
  if (!existing) return NextResponse.json({ error: "Reclamación no encontrada." }, { status: 404 });
  if (body.verified) {
    const updated = await db.achievement.update({
      where: { userId_code: { userId: auth.user.id, code: body.code } },
      data: { verifiedByAi: true, verifiedAt: new Date() },
    });
    return NextResponse.json({ achievement: updated });
  }
  await db.achievement.delete({ where: { userId_code: { userId: auth.user.id, code: body.code } } });
  return NextResponse.json({ ok: true, deleted: true });
}
