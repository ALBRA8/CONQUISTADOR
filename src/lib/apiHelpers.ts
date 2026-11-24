import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/session";
import type { User } from "@prisma/client";

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code: code || "error" }, { status });
}

export async function getUserFromRequest(req: NextRequest): Promise<User | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = parseSessionToken(token);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  return user;
}

export async function requireUser(req: NextRequest): Promise<{ user: User } | { res: NextResponse }> {
  const user = await getUserFromRequest(req);
  if (!user) return { res: jsonError("Necesitas entrar con tu correo para continuar.", 401, "unauthenticated") };
  if (!user.ageConfirmedAt || !user.consentAcceptedAt) {
    return { res: jsonError("Falta confirmar edad y consentimiento.", 403, "no_consent") };
  }
  return { user };
}

// Límite diario de llamadas de IA (sección 4.3). Plan base: 40 llamadas/día.
export const DAILY_LIMIT = Number(process.env.DAILY_AI_LIMIT || 40);

export async function checkQuota(user: User): Promise<{ ok: true; user: User } | { ok: false; res: NextResponse }> {
  const now = new Date();
  let used = user.dailyCallsUsed;
  let resetAt = user.dailyCallsResetAt;
  if (!resetAt || resetAt.getTime() < now.getTime()) {
    // Ventana de 24h vencida: reiniciar
    resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    used = 0;
    const updated = await db.user.update({
      where: { id: user.id },
      data: { dailyCallsUsed: 0, dailyCallsResetAt: resetAt },
    });
    return { ok: true, user: updated };
  }
  if (used >= DAILY_LIMIT) {
    return {
      ok: false,
      res: jsonError(
        `Llegaste al límite de ${DAILY_LIMIT} consultas de hoy. Mañana se reabre a las ${resetAt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}.`,
        429,
        "quota"
      ),
    };
  }
  return { ok: true, user };
}

export async function consumeQuota(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) return;
  await db.user.update({ where: { id: userId }, data: { dailyCallsUsed: { increment: 1 } } });
}

export async function audit(userId: string, action: string, meta?: unknown) {
  try {
    await db.auditLog.create({
      data: { userId, action, meta: meta ? JSON.stringify(meta).slice(0, 4000) : null },
    });
  } catch {
    // el registro de auditoría no debe romper la operación principal
  }
}

// Reintento con espera creciente (sección 4.3)
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
