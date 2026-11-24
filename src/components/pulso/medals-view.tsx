"use client";

import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/pulso";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, MeasuredBadge } from "@/components/pulso/shared";
import { Medal, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Achievement = {
  id: string;
  code: string;
  title: string;
  evidenceText: string | null;
  verifiedByAi: boolean;
  claimedAt: string | null;
  verifiedAt: string | null;
};

type MedalsData = {
  achievements: Achievement[];
  level: { name: string; score: number; next: { min: number; name: string } | null };
  counters: { fichas: number; citasHechas: number; mensajesEnviados: number };
};

const LEVELS = [
  { min: 0, name: "Arranque" },
  { min: 1, name: "Primer Latido" },
  { min: 3, name: "Ritmo" },
  { min: 6, name: "Compás" },
  { min: 10, name: "Sobremesa" },
  { min: 16, name: "Mesa Dos" },
  { min: 25, name: "Pulso Firme" },
];

// Medallas reclamables con evidencia (verificadas con IA). Si no hay evidencia
// que la sustente, la medalla no se entrega (secciones 6.11 y 14.2.20).
const CLAIMABLE = [
  {
    code: "conversacion_revivida",
    title: "Revivió una conversación fría",
    hint: "Cuenta con quién, cuánto llevaba muerta y qué mensaje la reactivó (puedes pegar el fragmento).",
  },
  {
    code: "primer_invitacion",
    title: "Primera invitación como plan (A o B)",
    hint: "Pega el mensaje exacto con el que invitaste, con dos opciones de día.",
  },
  {
    code: "respeto_no",
    title: "Respetó un no",
    hint: "Cuenta qué pasó: qué dijo ella, cuándo te detuviste y qué hiciste después. Aquí también se celebra.",
  },
];

// Medallas automáticas: hitos medibles en la propia cuenta
const AUTO_MEDALS = [
  { code: "primera_ficha", title: "Primera ficha creada" },
  { code: "primera_radiografia", title: "Primera radiografía" },
  { code: "primera_cita_agendada", title: "Primera cita agendada" },
  { code: "primera_cita_hecha", title: "Primera cita hecha" },
  { code: "primer_mensaje_respondido", title: "Primer mensaje enviado y respondido" },
];

export function MedalsView() {
  const [data, setData] = useState<MedalsData | null>(null);
  const [claiming, setClaiming] = useState<null | typeof CLAIMABLE[0]>(null);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api<MedalsData>("/api/achievements");
      setData(res);
    } catch (e) {
      toast({ title: "No se pudieron cargar las medallas", description: (e as Error).message, variant: "destructive" });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function claim() {
    if (!claiming || !evidence.trim()) return;
    setBusy(true);
    try {
      await api("/api/achievements", {
        method: "POST",
        body: JSON.stringify({ code: claiming.code, title: claiming.title, evidence }),
      });
      const res = await api<{ cumple: string; cita_textual?: string; que_falta?: string }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "achievement_verify", code: claiming.code, title: claiming.title, evidence }),
      });
      const verified = res.cumple === "sí" || res.cumple === "si" || res.cumple === "Sí" || res.cumple === "Si";
      await api("/api/achievements", {
        method: "PUT",
        body: JSON.stringify({ code: claiming.code, verified }),
      });
      if (verified) {
        toast({ title: "Medalla concedida", description: claiming.title });
        setClaiming(null);
        setEvidence("");
      } else {
        toast({
          title: "Aún no se concede",
          description: res.que_falta || "La evidencia no demuestra el hito. Añade más detalle y vuelve a intentar.",
          variant: "destructive",
        });
      }
      await load();
    } catch (e) {
      toast({ title: "No se pudo verificar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Cargando medallas…</div>;

  const earnedCodes = new Set(data.achievements.map((a) => a.code));

  return (
    <div className="space-y-5 p-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Medal className="h-5 w-5 text-amber-400" /> Progreso
      </h1>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Nivel actual</p>
            <p className="text-2xl font-semibold tracking-tight">{data.level.name}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p className="flex items-center justify-end gap-1.5">
              Puntos: {data.level.score} <MeasuredBadge />
            </p>
            {data.level.next && <p className="mt-0.5">Próximo nivel: {data.level.next.name} en {data.level.next.min - data.level.score} puntos</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <span
              key={l.name}
              className={cn(
                "rounded-full border border-border px-2.5 py-1 text-xs",
                data.level.score >= l.min ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "text-muted-foreground"
              )}
            >
              {l.name}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Puntos = fichas + citas hechas ×2 + mensajes enviados. Todo medido en tu cuenta, nada de cifras externas.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Medallas ganadas ({data.achievements.length})</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {AUTO_MEDALS.map((m) => {
            const earned = earnedCodes.has(m.code);
            const a = data.achievements.find((x) => x.code === m.code);
            return (
              <div
                key={m.code}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-sm",
                  earned ? "border-amber-500/40 bg-amber-500/5" : "border-border opacity-60"
                )}
              >
                <Medal className={cn("h-5 w-5 shrink-0", earned ? "text-amber-400" : "text-muted-foreground")} />
                <div className="min-w-0">
                  <p className="font-medium">{m.title}</p>
                  {a?.verifiedAt && <p className="text-[11px] text-muted-foreground">desde {new Date(a.verifiedAt).toLocaleDateString("es")}</p>}
                </div>
                {earned && <ShieldCheck className="ml-auto h-4 w-4 text-emerald-400" />}
              </div>
            );
          })}
          {data.achievements
            .filter((a) => !AUTO_MEDALS.some((m) => m.code === a.code))
            .map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <Medal className="h-5 w-5 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  {a.evidenceText && <p className="truncate text-[11px] text-muted-foreground">evidencia: "{a.evidenceText}"</p>}
                </div>
                {a.verifiedByAi && <ShieldCheck className="ml-auto h-4 w-4 text-emerald-400" />}
              </div>
            ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Retos con evidencia</h2>
        <p className="text-xs text-muted-foreground">
          Estas medallas exigen evidencia escrita por ti. El verificador la revisa: si no la sustenta, no se entrega.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {CLAIMABLE.map((c) => (
            <button
              key={c.code}
              onClick={() => setClaiming(c)}
              className="rounded-lg border border-dashed border-border p-4 text-left text-sm transition-colors hover:border-amber-500/40"
            >
              <p className="font-medium">{c.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {earnedCodes.has(c.code) ? "Conseguida — puedes añadir más evidencia" : "Reclamar con evidencia"}
              </p>
            </button>
          ))}
        </div>
      </section>

      {claiming && (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="font-medium">{claiming.title}</p>
          <p className="text-sm text-muted-foreground">{claiming.hint}</p>
          <Textarea rows={4} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Escribe aquí tu evidencia…" />
          <div className="flex gap-2">
            <Button onClick={claim} disabled={busy || !evidence.trim()}>
              {busy ? "Verificando…" : "Enviar a verificación"}
            </Button>
            <Button variant="ghost" onClick={() => setClaiming(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {data.achievements.length === 0 && (
        <EmptyState
          title="Sin medallas todavía"
          body="Crean tu primera ficha o envía tu primer mensaje: los hitos reales se marcan solos, medidos en tu cuenta."
        />
      )}
    </div>
  );
}
