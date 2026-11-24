import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

// Paso 2: verifica el código de un solo uso y crea la cuenta si no existe.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string; code?: string } | null;
  if (!body?.email || !body?.code) {
    return NextResponse.json({ error: "Faltan el correo o el código." }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  const code = body.code.trim();

  const record = await db.loginCode.findFirst({
    where: { email, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) {
    return NextResponse.json({ error: "El código expiró. Pide uno nuevo." }, { status: 400 });
  }
  if (record.attempts >= 5) {
    return NextResponse.json({ error: "Demasiados intentos con este código. Pide uno nuevo." }, { status: 429 });
  }
  if (record.code !== code) {
    await db.loginCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Código incorrecto. Revisa los dígitos." }, { status: 400 });
  }

  await db.loginCode.update({ where: { id: record.id }, data: { used: true } });

  let user = await db.user.findUnique({ where: { email } });
  let isNew = false;
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        ageConfirmedAt: record.ageOk ? new Date() : null,
        consentAcceptedAt: record.consentOk ? new Date() : null,
      },
    });
    isNew = true;
  } else if (!user.ageConfirmedAt || !user.consentAcceptedAt) {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        ageConfirmedAt: user.ageConfirmedAt || (record.ageOk ? new Date() : null),
        consentAcceptedAt: user.consentAcceptedAt || (record.consentOk ? new Date() : null),
      },
    });
  }

  const res = NextResponse.json({
    ok: true,
    isNew,
    needsOnboarding: !user.onboardingDoneAt,
  });
  return setSessionCookie(res, user.id);
}
