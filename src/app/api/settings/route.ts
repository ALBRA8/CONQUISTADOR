import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/apiHelpers";

// Ajustes: idioma, tono por defecto, longitud preferida, fin de onboarding
const TONES = ["misterioso", "coqueto", "casual", "suave", "atrevido", "divertido", "romantico", "directo"];

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as
    | { locale?: string; toneDefault?: string; lengthPref?: string; onboardingDone?: boolean }
    | null;
  const data: Record<string, unknown> = {};
  if (body?.locale === "es" || body?.locale === "en") data.locale = body.locale;
  if (body?.toneDefault && TONES.includes(body.toneDefault)) data.toneDefault = body.toneDefault;
  if (body?.lengthPref === "corta" || body?.lengthPref === "estandar") data.lengthPref = body.lengthPref;
  if (body?.onboardingDone === true) data.onboardingDoneAt = new Date();

  const updated = await db.user.update({ where: { id: auth.user.id }, data });
  await audit(auth.user.id, "settings_updated", { keys: Object.keys(data) });
  return NextResponse.json({
    user: { locale: updated.locale, toneDefault: updated.toneDefault, lengthPref: updated.lengthPref, onboardingDone: Boolean(updated.onboardingDoneAt) },
  });
}
