import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiHelpers";
import { checkFirstMessageResponded } from "@/lib/achievements";

// Sugerencias entregadas por el coach: marcar como enviado y registrar resultado
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const url = new URL(req.url);
  const womanId = url.searchParams.get("womanId");
  const suggestions = await db.suggestion.findMany({
    where: { woman: { userId: auth.user.id }, ...(womanId ? { womanId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ suggestions });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as
    | { id?: string; sentAt?: string; outcome?: string; chosenIndex?: number; chosenText?: string }
    | null;
  if (!body?.id) return NextResponse.json({ error: "Falta el id de la sugerencia." }, { status: 400 });
  const s = await db.suggestion.findFirst({ where: { id: body.id, woman: { userId: auth.user.id } } });
  if (!s) return NextResponse.json({ error: "Sugerencia no encontrada." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.sentAt) {
    const d = new Date(body.sentAt);
    if (!isNaN(d.getTime())) data.sentAt = d;
  } else if (body.sentAt === null) {
    data.sentAt = null;
  }
  if (body.outcome && ["sin_respuesta", "respondio", "cita", "descartado"].includes(body.outcome)) {
    data.outcome = body.outcome;
  }
  if (typeof body.chosenIndex === "number") data.chosenIndex = body.chosenIndex;
  if (typeof body.chosenText === "string") data.chosenText = body.chosenText.slice(0, 2000);

  const updated = await db.suggestion.update({ where: { id: s.id }, data });
  await checkFirstMessageResponded(auth.user.id);
  return NextResponse.json({ suggestion: updated });
}
