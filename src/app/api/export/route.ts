import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/apiHelpers";
import { computeUserStats } from "@/lib/stats";

// Exportar TODOS los datos del usuario: JSON completo + CSV legibles (sección 3.1.11)
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";

  const [user, women, threads, achievements, auditLogs] = await Promise.all([
    db.user.findUnique({ where: { id: auth.user.id } }),
    db.woman.findMany({
      where: { userId: auth.user.id },
      include: {
        messages: true,
        analyses: true,
        suggestions: true,
        dates: true,
        threads: { include: { turns: true } },
      },
    }),
    db.coachThread.findMany({ where: { userId: auth.user.id }, include: { turns: true } }),
    db.achievement.findMany({ where: { userId: auth.user.id } }),
    db.auditLog.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const stats = await computeUserStats(auth.user.id);

  if (format === "csv") {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines: string[] = [];
    lines.push("# mujeres");
    lines.push("id,nombre,edad,ciudad,ocupacion,perfil,estado,interes,etapa,telefono,canal,donde_se_conocieron,notas,creada");
    for (const w of women) {
      lines.push([w.id, w.name, w.age, w.city, w.occupation, w.archetype, w.status, w.interestLevel, w.stage, w.phone, w.channel, w.metWhere, w.notes, w.createdAt.toISOString()].map(esc).join(","));
    }
    lines.push("");
    lines.push("# mensajes");
    lines.push("id,mujer,emisor,texto,fecha_hora,origen,confianza");
    for (const w of women) {
      for (const m of w.messages) {
        lines.push([m.id, w.name, m.sender === "me" ? "yo" : "ella", m.body, m.sentAt?.toISOString() || "", m.source, m.confidence].map(esc).join(","));
      }
    }
    lines.push("");
    lines.push("# citas");
    lines.push("id,mujer,fecha_hora,lugar,estado");
    for (const w of women) {
      for (const d of w.dates) {
        lines.push([d.id, w.name, d.scheduledAt.toISOString(), d.place, d.status].map(esc).join(","));
      }
    }
    lines.push("");
    lines.push("# metricas medidas en tu cuenta");
    lines.push("clave,valor");
    for (const [k, v] of Object.entries(stats)) lines.push([k, v].map(esc).join(","));
    const csv = lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pulso-export.csv"`,
      },
    });
  }

  const exportData = {
    app: "Pulso",
    exportedAt: new Date().toISOString(),
    cuenta: user
      ? { email: user.email, locale: user.locale, creado: user.createdAt, edadConfirmada: user.ageConfirmedAt, consentimiento: user.consentAcceptedAt }
      : null,
    metricasMedidas: stats,
    fichas: women.map((w) => ({
      ...w,
      coachThreads: undefined,
      mensajes: w.messages,
      analisis: w.analyses,
      sugerencias: w.suggestions,
      citas: w.dates,
    })),
    hilosCoach: threads.map((t) => ({ id: t.id, womanId: t.womanId, protocol: t.protocol, step: t.step, turns: t.turns })),
    medallas: achievements,
    auditoria: auditLogs,
  };

  await audit(auth.user.id, "data_exported", { format: "json" });
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulso-export.json"`,
    },
  });
}
