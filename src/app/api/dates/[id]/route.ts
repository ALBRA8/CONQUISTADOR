import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/apiHelpers";
import { grantAuto } from "@/lib/achievements";

const STATUSES = ["agendada", "hecha", "cancelada", "no_show"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const date = await db.dateEntry.findFirst({ where: { id, woman: { userId: auth.user.id } } });
  if (!date) return NextResponse.json({ error: "No encontré esa cita." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { status?: string; scheduledAt?: string; place?: string }
    | null;
  const data: Record<string, unknown> = {};
  if (body?.status && STATUSES.includes(body.status)) data.status = body.status;
  if (body?.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (!isNaN(d.getTime())) data.scheduledAt = d;
  }
  if (typeof body?.place === "string") data.place = body.place.slice(0, 200);

  const updated = await db.dateEntry.update({ where: { id }, data });
  if (body?.status === "hecha") {
    await grantAuto(auth.user.id, "primera_cita_hecha");
    await db.woman.update({ where: { id: date.womanId }, data: { status: "caliente", stage: "post_cita" } });
  }
  if (body?.status === "cancelada" || body?.status === "no_show") {
    await db.woman.update({ where: { id: date.womanId }, data: { status: "tibio" } });
  }
  await audit(auth.user.id, "date_updated", { dateId: id, status: body?.status });
  return NextResponse.json({ date: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const date = await db.dateEntry.findFirst({ where: { id, woman: { userId: auth.user.id } } });
  if (!date) return NextResponse.json({ error: "No encontré esa cita." }, { status: 404 });
  await db.dateEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
