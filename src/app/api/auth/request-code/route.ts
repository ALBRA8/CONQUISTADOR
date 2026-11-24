import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Paso 1 del acceso sin contraseña (OTP demo): registra el código de 6 dígitos.
// DECISIÓN DOCUMENTADA: este sandbox no envía correos reales, así que el código
// se devuelve en la respuesta para mostrarlo en pantalla. En producción se
// reemplazaría por el envío real (SMTP/SMS) sin cambiar el resto del flujo.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; ageOk?: boolean; consentOk?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });

  const email = (body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }
  if (!body.ageOk) {
    return NextResponse.json({ error: "Debes confirmar que eres mayor de edad.", code: "age" }, { status: 400 });
  }
  if (!body.consentOk) {
    return NextResponse.json({ error: "Debes aceptar las reglas de uso para continuar." }, { status: 400 });
  }

  // Límite de intentos: máximo 3 códigos por correo cada 15 minutos
  const recent = await db.loginCode.findMany({
    where: { email, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
  });
  if (recent.length >= 3) {
    return NextResponse.json(
      { error: "Demasiados códigos pedidos en poco tiempo. Espera unos minutos." },
      { status: 429 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.loginCode.create({
    data: {
      email,
      code,
      ageOk: Boolean(body.ageOk),
      consentOk: Boolean(body.consentOk),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  // MODO DEMO: el código viaja en la respuesta para pintarlo en pantalla.
  return NextResponse.json({ ok: true, demoCode: code });
}
