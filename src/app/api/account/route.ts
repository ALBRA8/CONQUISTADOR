import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/apiHelpers";
import { clearSessionCookie } from "@/lib/session";

// Borrar cuenta y TODOS los datos (sección 3.1.11 y 14.1).
// Requiere confirmación escrita: el usuario escribe la palabra BORRAR.
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  if (!body?.confirm || body.confirm.trim().toUpperCase() !== "BORRAR") {
    return NextResponse.json(
      { error: "Escribe BORRAR en mayúsculas para confirmar el borrado definitivo." },
      { status: 400 }
    );
  }

  const email = auth.user.email;
  // Registro mínimo de que hubo borrado real (queda sin datos personales)
  await db.deletionLog.create({
    data: { emailHash: createHash("sha256").update(email).digest("hex").slice(0, 24), reason: "user_request" },
  });
  await audit(auth.user.id, "account_deleted", {});

  // El cascade del esquema elimina fichas, mensajes, análisis, hilos, citas, medallas y auditoría
  await db.user.delete({ where: { id: auth.user.id } });

  return clearSessionCookie(NextResponse.json({ ok: true }));
}
