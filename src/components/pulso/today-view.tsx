"use client";

import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { CopyButton, EmptyState, EstimationNotice } from "@/components/pulso/shared";
import { api } from "@/lib/pulso";
import { RefreshCw, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Accion = {
  prioridad?: number;
  mujer?: string;
  tipo?: string;
  diagnostico?: string;
  mensaje?: string;
  urgencia?: string;
};

// Planificador diario de 3 acciones (sección 6.11 / 8.10)
export function TodayView() {
  const { women, setView } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [acciones, setAcciones] = useState<Accion[] | null>(null);
  const { refreshQuota } = useAppStore();

  async function plan() {
    setBusy(true);
    try {
      const res = await api<{ acciones: Accion[] }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "planner" }),
      });
      setAcciones(res.acciones);
      refreshQuota((s) => s);
    } catch (e) {
      toast({ title: "El plan no salió", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const urgenciaTone: Record<string, string> = {
    hoy: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    esta_semana: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    cuando_reaccione: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Sun className="h-5 w-5 text-amber-400" /> Hoy
      </h1>
      {women.length === 0 ? (
        <EmptyState
          title="No hay fichas activas"
          body="Añade una persona y su conversación: el planificador elegirá las 3 acciones de mayor valor para tu día."
          action={<Button onClick={() => setView("contacts")}>Ir a contactos</Button>}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            El coach revisa todas tus conversaciones activas y te propone las tres acciones que más valen hoy. Respetando siempre los "no" ya dados.
          </p>
          <Button onClick={plan} disabled={busy}>
            {busy ? (
              <>
                <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> Leyendo tus conversaciones…
              </>
            ) : (
              "Planificar mi hoy"
            )}
          </Button>

          {acciones && (
            <div className="space-y-3">
              {acciones.map((a, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Acción {a.prioridad || i + 1}</Badge>
                    {a.mujer && <span className="font-semibold">{a.mujer}</span>}
                    {a.tipo && <Badge variant="outline">{a.tipo}</Badge>}
                    {a.urgencia && (
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${urgenciaTone[a.urgencia] || urgenciaTone.cuando_reaccione}`}>
                        {a.urgencia.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {a.diagnostico && <p className="text-sm text-muted-foreground">{a.diagnostico}</p>}
                  {a.mensaje && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary p-3">
                      <p className="min-w-0 flex-1 text-sm">{a.mensaje}</p>
                      <CopyButton text={a.mensaje} />
                    </div>
                  )}
                </div>
              ))}
              <EstimationNotice>
                Las prioridades son una lectura de la IA sobre tus conversaciones. No hay cifras externas: solo lo medido en tu cuenta.
              </EstimationNotice>
            </div>
          )}
        </>
      )}
    </div>
  );
}
