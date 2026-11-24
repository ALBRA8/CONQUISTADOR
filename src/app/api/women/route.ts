import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/apiHelpers";

const STATUSES = ["frio", "tibio", "caliente", "sinrespuesta", "cita"];

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("archived") === "1";

  const women = await db.woman.findMany({
    where: { userId: auth.user.id, ...(includeArchived ? {} : { archivedAt: null }) },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      dates: { where: { status: "agendada" }, orderBy: { scheduledAt: "asc" }, take: 1 },
    },
  });

  const list = women.map((w) => {
    const last = w.messages[0];
    const lastAt = last?.sentAt || (last ? new Date(last.createdAt) : null);
    return {
      id: w.id,
      name: w.name,
      age: w.age,
      city: w.city,
      occupation: w.occupation,
      photo: w.photo,
      archetype: w.archetype,
      status: w.status,
      stage: w.stage,
      interestLevel: w.interestLevel,
      phone: w.phone,
      lastMessage: last ? { sender: last.sender, body: last.body, at: lastAt?.toISOString() || null } : null,
      nextDate: w.dates[0]
        ? { id: w.dates[0].id, scheduledAt: w.dates[0].scheduledAt.toISOString(), place: w.dates[0].place }
        : null,
      createdAt: w.createdAt.toISOString(),
    };
  });

  // Orden por defecto: las que necesitan acción hoy primero (sección 6.3)
  list.sort((a, b) => {
    const score = (x: typeof a) => {
      let s = 0;
      if (x.nextDate) s -= 100; // cita agendada: máxima prioridad
      if (x.status === "sinrespuesta") s -= 50;
      if (x.lastMessage?.sender === "me") s -= 30; // balón en su lado del usuario
      if (!x.lastMessage) s -= 10; // sin empezar
      return s;
    };
    return score(a) - score(b);
  });

  return NextResponse.json({ women: list });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  const status = typeof body.status === "string" && STATUSES.includes(body.status) ? body.status : "tibio";
  const woman = await db.woman.create({
    data: {
      userId: auth.user.id,
      name: body.name.trim().slice(0, 80),
      age: typeof body.age === "number" ? Math.min(Math.max(Math.round(body.age), 18), 99) : null,
      city: typeof body.city === "string" ? body.city.slice(0, 80) : null,
      occupation: typeof body.occupation === "string" ? body.occupation.slice(0, 80) : null,
      photo: typeof body.photo === "string" ? body.photo.slice(0, 2_000_000) : null,
      metWhere: typeof body.metWhere === "string" ? body.metWhere.slice(0, 300) : null,
      channel: typeof body.channel === "string" ? body.channel.slice(0, 40) : null,
      phone: typeof body.phone === "string" ? body.phone.slice(0, 30) : null,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 4000) : null,
      status,
      interestLevel: typeof body.interestLevel === "number" ? Math.min(Math.max(Math.round(body.interestLevel), 0), 100) : 50,
      stage: typeof body.stage === "string" ? body.stage.slice(0, 40) : "inicio",
    },
  });

  await audit(auth.user.id, "woman_created", { womanId: woman.id, name: woman.name });
  // Medalla automática: primera ficha
  await grantAuto(auth.user.id, "primera_ficha", "Primera ficha creada");
  return NextResponse.json({ woman: { id: woman.id, name: woman.name } });
}

async function grantAuto(userId: string, code: string, title: string) {
  const exists = await db.achievement.findUnique({ where: { userId_code: { userId, code } } });
  if (!exists) {
    await db.achievement.create({
      data: { userId, code, title, verifiedByAi: false, claimedAt: new Date(), verifiedAt: new Date() },
    });
  }
}
