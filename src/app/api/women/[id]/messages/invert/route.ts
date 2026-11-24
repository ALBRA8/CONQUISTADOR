import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiHelpers";

// Corregir el sentido de la conversación: invierte los emisores de un rango
// (o de todo el historial) porque la importación puede equivocarse.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const woman = await db.woman.findFirst({ where: { id, userId: auth.user.id } });
  if (!woman) return NextResponse.json({ error: "No existe esa ficha." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { fromIndex?: number; toIndex?: number } | null;
  const messages = await db.message.findMany({
    where: { womanId: id },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
  });

  const from = typeof body?.fromIndex === "number" ? Math.max(0, body.fromIndex) : 0;
  const to = typeof body?.toIndex === "number" ? Math.min(messages.length - 1, body.toIndex) : messages.length - 1;

  const ids: string[] = [];
  for (let i = from; i <= to && i < messages.length; i++) {
    ids.push(messages[i].id);
  }
  if (ids.length === 0) return NextResponse.json({ error: "No hay mensajes en ese rango." }, { status: 400 });

  // SQLite no soporta updateMany con alternancia condicional: transacción simple
  const me = ids.filter((mid) => messages.find((m) => m.id === mid)?.sender === "me");
  const her = ids.filter((mid) => messages.find((m) => m.id === mid)?.sender === "her");
  await db.$transaction([
    db.message.updateMany({ where: { id: { in: me } }, data: { sender: "her" } }),
    db.message.updateMany({ where: { id: { in: her } }, data: { sender: "me" } }),
  ]);

  const updated = await db.message.findMany({
    where: { womanId: id },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ok: true, inverted: ids.length, messages: updated });
}
