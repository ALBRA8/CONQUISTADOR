import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/apiHelpers";

async function getOwnedWoman(userId: string, id: string) {
  return db.woman.findFirst({ where: { id, userId, archivedAt: null } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const woman = await getOwnedWoman(auth.user.id, id);
  if (!woman) return NextResponse.json({ error: "No existe esa ficha." }, { status: 404 });

  const [messages, analyses, dates, suggestions, thread] = await Promise.all([
    db.message.findMany({ where: { womanId: id }, orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }] }),
    db.analysis.findMany({ where: { womanId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.dateEntry.findMany({ where: { womanId: id }, orderBy: { scheduledAt: "desc" } }),
    db.suggestion.findMany({ where: { womanId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.coachThread.findFirst({
      where: { womanId: id, userId: auth.user.id },
      orderBy: { updatedAt: "desc" },
      include: { turns: { orderBy: { createdAt: "asc" }, take: 40 } },
    }),
  ]);

  return NextResponse.json({
    woman,
    messages,
    analyses,
    dates,
    suggestions,
    thread: thread
      ? {
          id: thread.id,
          protocol: thread.protocol,
          step: thread.step,
          updatedAt: thread.updatedAt,
          turns: thread.turns.map((t) => ({
            id: t.id,
            role: t.role,
            content: t.content,
            blocks: t.blocks ? JSON.parse(t.blocks) : null,
            createdAt: t.createdAt,
          })),
        }
      : null,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const woman = await getOwnedWoman(auth.user.id, id);
  if (!woman) return NextResponse.json({ error: "No existe esa ficha." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  if (body.age === null || typeof body.age === "number") data.age = body.age;
  if (body.city === null || typeof body.city === "string") data.city = body.city;
  if (body.occupation === null || typeof body.occupation === "string") data.occupation = body.occupation;
  if (body.photo === null || typeof body.photo === "string") data.photo = body.photo;
  if (body.metWhere === null || typeof body.metWhere === "string") data.metWhere = body.metWhere;
  if (body.channel === null || typeof body.channel === "string") data.channel = body.channel;
  if (body.phone === null || typeof body.phone === "string") data.phone = body.phone;
  if (body.notes === null || typeof body.notes === "string") data.notes = body.notes;
  if (body.archetype === null || typeof body.archetype === "string") data.archetype = body.archetype;
  if (body.stage === null || typeof body.stage === "string") data.stage = body.stage;
  if (typeof body.status === "string" && ["frio", "tibio", "caliente", "sinrespuesta", "cita"].includes(body.status))
    data.status = body.status;
  if (typeof body.interestLevel === "number") data.interestLevel = Math.min(Math.max(Math.round(body.interestLevel), 0), 100);
  if (body.archivedAt === null) data.archivedAt = null;

  const updated = await db.woman.update({ where: { id }, data });
  await audit(auth.user.id, "woman_updated", { womanId: id });
  return NextResponse.json({ woman: updated });
}

// Archivar (nunca borrar sin confirmación explícita aparte)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const woman = await getOwnedWoman(auth.user.id, id);
  if (!woman) return NextResponse.json({ error: "No existe esa ficha." }, { status: 404 });

  await db.woman.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(auth.user.id, "woman_archived", { womanId: id });
  return NextResponse.json({ ok: true });
}
