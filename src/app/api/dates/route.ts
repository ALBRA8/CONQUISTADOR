import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/apiHelpers";
import { grantAuto } from "@/lib/achievements";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const dates = await db.dateEntry.findMany({
    where: { woman: { userId: auth.user.id } },
    include: { woman: { select: { name: true, photo: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  return NextResponse.json({ dates });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as
    | { womanId?: string; scheduledAt?: string; place?: string }
    | null;
  if (!body?.womanId || !body?.scheduledAt) {
    return NextResponse.json({ error: "Faltan la persona o la fecha de la cita." }, { status: 400 });
  }
  const woman = await db.woman.findFirst({ where: { id: body.womanId, userId: auth.user.id, archivedAt: null } });
  if (!woman) return NextResponse.json({ error: "No existe esa ficha." }, { status: 404 });

  const scheduledAt = new Date(body.scheduledAt);
  if (isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "La fecha no es válida." }, { status: 400 });
  }

  const date = await db.dateEntry.create({
    data: {
      womanId: woman.id,
      scheduledAt,
      place: typeof body.place === "string" ? body.place.slice(0, 200) : null,
    },
  });
  await db.woman.update({ where: { id: woman.id }, data: { status: "cita" } });
  await grantAuto(auth.user.id, "primera_cita_agendada");
  await audit(auth.user.id, "date_created", { dateId: date.id, womanId: woman.id });
  return NextResponse.json({ date });
}
