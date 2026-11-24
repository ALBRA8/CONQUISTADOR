import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiHelpers";

// Guardar la lista de mensajes CONFIRMADA por el usuario (desde capturas o .txt),
// evitando duplicados por contenido+hora+emisor.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as
    | {
        womanId?: string;
        source?: string;
        authorMap?: Record<string, string>; // autor del archivo -> "me" | "her"
        messages?: Array<{ sender?: string; body?: string; sentAt?: string | null; hora?: string | null; confidence?: number }>;
      }
    | null;
  if (!body?.womanId || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }
  const woman = await db.woman.findFirst({ where: { id: body.womanId, userId: auth.user.id } });
  if (!woman) return NextResponse.json({ error: "No existe esa ficha." }, { status: 404 });

  const source = body.source === "screenshot" ? "screenshot" : "txt_import";
  const existing = await db.message.findMany({ where: { womanId: body.womanId } });
  const keyOf = (sender: string, text: string, iso: string | null) =>
    `${sender}|${text.slice(0, 120).trim().toLowerCase()}|${iso || ""}`;
  const existingKeys = new Set(existing.map((m) => keyOf(m.sender, m.body, m.sentAt?.toISOString() || null)));

  const toCreate: Array<{
    womanId: string;
    sender: string;
    body: string;
    sentAt: Date | null;
    source: string;
    confidence: number | null;
  }> = [];

  for (const m of body.messages) {
    let sender = m.sender === "her" ? "her" : m.sender === "me" ? "me" : null;
    if (!sender && body.authorMap && typeof (m as { author?: string }).author === "string") {
      sender = body.authorMap[(m as { author?: string }).author as string] === "me" ? "me" : "her";
    }
    if (!sender) sender = "her";
    const text = (m.body || "").trim().slice(0, 4000);
    if (!text) continue;
    let sentAt: Date | null = null;
    if (m.sentAt) {
      const d = new Date(m.sentAt);
      if (!isNaN(d.getTime())) sentAt = d;
    } else if (m.hora) {
      // Solo la hora del día: se coloca hoy con esa hora (el usuario puede editarla)
      const today = new Date();
      const hm = /^(\d{1,2}):(\d{2})/.exec(m.hora);
      if (hm) {
        today.setHours(+hm[1], +hm[2], 0, 0);
        sentAt = today;
      }
    }
    const key = keyOf(sender, text, sentAt?.toISOString() || null);
    if (existingKeys.has(key)) continue; // sin duplicados
    existingKeys.add(key);
    toCreate.push({
      womanId: body.womanId,
      sender,
      body: text,
      sentAt,
      source,
      confidence: typeof m.confidence === "number" ? m.confidence : source === "screenshot" ? 0.6 : null,
    });
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ ok: true, added: 0, messages: existing, note: "Nada nuevo que añadir: todos estaban guardados." });
  }

  await db.message.createMany({ data: toCreate });
  const saved = await db.message.findMany({
    where: { womanId: body.womanId },
    orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ ok: true, added: toCreate.length, messages: saved });
}
