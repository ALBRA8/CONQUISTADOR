import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiHelpers";

// Editar, cambiar emisor o borrar un mensaje individual
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const msg = await db.message.findFirst({
    where: { id },
    include: { woman: true },
  });
  if (!msg || msg.woman.userId !== auth.user.id) {
    return NextResponse.json({ error: "Mensaje no encontrado." }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as
    | { body?: string; sender?: string; sentAt?: string | null }
    | null;
  if (!body) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.body === "string" && body.body.trim()) data.body = body.body.trim().slice(0, 4000);
  if (body.sender === "me" || body.sender === "her") data.sender = body.sender;
  if (body.sentAt === null) data.sentAt = null;
  else if (typeof body.sentAt === "string") {
    const d = new Date(body.sentAt);
    if (!isNaN(d.getTime())) data.sentAt = d;
  }

  const updated = await db.message.update({ where: { id }, data });
  return NextResponse.json({ message: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const msg = await db.message.findFirst({ where: { id }, include: { woman: true } });
  if (!msg || msg.woman.userId !== auth.user.id) {
    return NextResponse.json({ error: "Mensaje no encontrado." }, { status: 404 });
  }
  await db.message.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
