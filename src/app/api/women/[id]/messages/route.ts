import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiHelpers";

// Mensajes de una ficha: listar y añadir a mano
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const woman = await db.woman.findFirst({ where: { id, userId: auth.user.id } });
  if (!woman) return NextResponse.json({ error: "No existe esa ficha." }, { status: 404 });
  const messages = await db.message.findMany({
    where: { womanId: id },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const woman = await db.woman.findFirst({ where: { id, userId: auth.user.id } });
  if (!woman) return NextResponse.json({ error: "No existe esa ficha." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { messages?: Array<{ sender?: string; body?: string; sentAt?: string | null }> }
    | null;
  const incoming = Array.isArray(body?.messages) ? body!.messages! : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: "No llegó ningún mensaje para guardar." }, { status: 400 });
  }

  const created = [];
  for (const m of incoming) {
    if (!m.body?.trim()) continue;
    const sender = m.sender === "her" ? "her" : "me";
    const sentAt = m.sentAt ? new Date(m.sentAt) : null;
    created.push({
      womanId: id,
      sender,
      body: m.body.trim().slice(0, 4000),
      sentAt: sentAt && !isNaN(sentAt.getTime()) ? sentAt : null,
      source: "manual" as const,
    });
  }
  if (created.length === 0) {
    return NextResponse.json({ error: "Los mensajes llegaron vacíos." }, { status: 400 });
  }

  await db.message.createMany({ data: created });
  const saved = await db.message.findMany({
    where: { womanId: id },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ok: true, messages: saved });
}
