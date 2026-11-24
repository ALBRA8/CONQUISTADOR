import { NextRequest, NextResponse } from "next/server";
import { requireUser, DAILY_LIMIT } from "@/lib/apiHelpers";
import { computeUserStats } from "@/lib/stats";
import { aiProviderName } from "@/lib/ai/provider";

// Estado de la sesión: usuario, cuota de IA y métricas medidas.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const user = auth.user;

  const stats = await computeUserStats(user.id);
  const resetHour = user.dailyCallsResetAt
    ? user.dailyCallsResetAt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
    : null;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      locale: user.locale,
      onboardingDone: Boolean(user.onboardingDoneAt),
      toneDefault: user.toneDefault,
      lengthPref: user.lengthPref,
    },
    quota: {
      used: user.dailyCallsUsed,
      limit: DAILY_LIMIT,
      resetAt: resetHour,
    },
    stats,
    provider: aiProviderName(),
  });
}
