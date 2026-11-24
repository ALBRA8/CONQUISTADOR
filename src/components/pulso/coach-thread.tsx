"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { api, type CoachTurnView, type Woman } from "@/lib/pulso";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/pulso/shared";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, RefreshCw, SendHorizonal, Clock } from "lucide-react";

// Panel del coach (el núcleo): responde en tres bloques separados
// [LECTURA] [HAZ ESTO] [DILE ESTO] + cierre, con hora sugerida (sección 6.7).

export function CoachThreadPanel({
  woman,
  thread,
  messages,
  onActivity,
}: {
  woman: Woman;
  thread: { id: string; protocol: string; step: number } | null;
  messages: Array<{ sender: string; sentAt: string | null }>;
  onActivity: () => void;
}) {
  const [turns, setTurns] = useState<CoachTurnView[]>(thread?.turns || []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSuggestionId, setLastSuggestionId] = useState<string | null>(null);
  const [protocolInfo, setProtocolInfo] = useState<{ step: number; total: number } | null>(
    thread && thread.protocol !== "none"
      ? { step: thread.step, total: PROTO_TOTALS[thread.protocol as keyof typeof PROTO_TOTALS] || 0 }
      : null
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const { refreshQuota } = useAppStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  async function send(variant?: string, rawOverride?: string) {
    const text = rawOverride || (variant ? `Variante: ${variant}` : input.trim());
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    const optimistic: CoachTurnView = { id: `tmp-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() };
    setTurns((t) => [...t, optimistic]);
    try {
      const res = await api<{
        blocks: CoachTurnView["blocks"];
        suggestionId: string | null;
        thread: { id: string; protocol: string; step: number; total: number };
        quotaLeft: number;
      }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "coach", womanId: woman.id, message: text, variant: variant || undefined }),
      });
      setTurns((t) => [
        ...t,
        { id: `a-${Date.now()}`, role: "assistant", content: res.blocks?.raw || "", blocks: res.blocks, createdAt: new Date().toISOString() },
      ]);
      setLastSuggestionId(res.suggestionId);
      setProtocolInfo(
        res.thread.protocol !== "none" ? { step: res.thread.step, total: res.thread.total } : null
      );
      refreshQuota(res.quotaLeft);
      onActivity();
    } catch (e) {
      const err = e as Error & { code?: string };
      setTurns((t) => t.filter((x) => x.id !== optimistic.id));
      setInput(text);
      toast({
        title: err.code === "quota" ? "Cuota del día agotada" : "El coach no pudo responder",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function markSent() {
    if (!lastSuggestionId) return;
    try {
      await api("/api/suggestions", {
        method: "PATCH",
        body: JSON.stringify({ id: lastSuggestionId, sentAt: new Date().toISOString() }),
      });
      toast({ title: "Marcado como enviado", description: "Si responde, vuelve y cuéntale al coach." });
      onActivity();
    } catch (e) {
      toast({ title: "No se pudo marcar", description: (e as Error).message, variant: "destructive" });
    }
  }

  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");

  return (
    <div className="space-y-4">
      <div className="pulso-scroll max-h-[52vh] space-y-4 overflow-y-auto rounded-lg border border-border bg-background/40 p-4">
        {turns.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Pregunta lo que quieras sobre la conversación con <span className="font-medium text-foreground">{woman.name}</span>. El coach responde con lectura, acción y el mensaje exacto con su hora.
          </div>
        )}
        {turns.map((t) =>
          t.role === "user" ? (
            <div key={t.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-amber-600/90 px-3.5 py-2 text-sm text-primary-foreground whitespace-pre-wrap break-words">
                {t.content.startsWith("Variante:") ? t.content.slice(9).trim() : t.content}
              </div>
            </div>
          ) : (
            <AssistantCards key={t.id} turn={t} womanName={woman.name} />
          )
        )}
        {busy && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
            Leyendo el historial de {woman.name}…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {protocolInfo && (
        <p className="text-xs text-muted-foreground">
          Procedimiento en curso: paso {Math.min(protocolInfo.step + 1, protocolInfo.total)} de {protocolInfo.total}.{" "}
          <button
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => send(undefined, "Sin protocolo, empezar de cero")}
          >
            Dejarlo y empezar de cero
          </button>
        </p>
      )}

      {lastAssistant?.blocks?.mensaje && !lastAssistant.blocks.alto && !/SIN MENSAJE/i.test(lastAssistant.blocks.mensaje) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={markSent}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Marcar como enviado
          </Button>
          <span className="text-xs text-muted-foreground">y las variantes:</span>
          {(["otra", "mas_corto", "mas_suave", "mas_directo"] as const).map((v) => (
            <Button key={v} size="sm" variant="ghost" disabled={busy} onClick={() => send(v)}>
              {v === "otra" ? "Otra" : v === "mas_corto" ? "Más corto" : v === "mas_suave" ? "Más suave" : "Más directo"}
            </Button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          rows={2}
          placeholder={`¿Qué pasa con ${woman.name}? Pega su último mensaje o describe la situación…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Tú escribes siempre en tu mensajería. Pulso solo aconseja.</p>
          <Button onClick={() => send()} disabled={busy || !input.trim()}>
            <SendHorizonal className="mr-1.5 h-4 w-4" /> Enviar al coach
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssistantCards({ turn, womanName }: { turn: CoachTurnView; womanName: string }) {
  let b = turn.blocks;
  if (!b) {
    return (
      <div className="max-w-[92%] whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm">
        {turn.content.replace(/\[FASE\s*\d+\]/gi, "").trim()}
      </div>
    );
  }
  // Limpieza defensiva: los marcadores internos [FASE n] jamás se pintan
  const clean = (s?: string) => s?.replace(/\[FASE\s*\d+\]/gi, "").trim();
  b = { ...b, lectura: clean(b.lectura), accion: clean(b.accion), mensaje: clean(b.mensaje), hora: clean(b.hora), si: clean(b.si) };
  if (!b) {
    return (
      <div className="max-w-[92%] whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm">
        {turn.content}
      </div>
    );
  }
  if (b.alto) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" /> Aquí se para
        </p>
        <p className="mt-2 text-sm text-foreground/90">{b.motivoAlto || b.raw}</p>
      </div>
    );
  }
  return (
    <div className="max-w-[95%] space-y-2">
      <CardBlock label="Lectura" tone="neutral" body={b.lectura} />
      <CardBlock label="Haz esto" tone="amber" body={b.accion} />
      {b.mensaje && !/SIN MENSAJE/i.test(b.mensaje) ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">Dile esto</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{b.mensaje}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton text={b.mensaje} />
            {b.hora && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {b.hora}
              </span>
            )}
          </div>
        </div>
      ) : (
        b.mensaje && (
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dile esto</p>
            <p className="mt-1 text-sm text-muted-foreground">Sin mensaje ahora: mira la acción.</p>
          </div>
        )
      )}
      <CardBlock label="Y después" tone="neutral" body={b.si} small />
    </div>
  );
}

function CardBlock({
  label,
  body,
  tone,
  small,
}: {
  label: string;
  body?: string;
  tone: "neutral" | "amber";
  small?: boolean;
}) {
  if (!body) return null;
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tone === "amber" ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
      )}
    >
      <p className={cn("font-semibold uppercase tracking-wide text-[11px]", tone === "amber" ? "text-amber-300" : "text-muted-foreground")}>
        {label}
      </p>
      <p className={cn("mt-1 whitespace-pre-wrap leading-snug", small ? "text-xs text-muted-foreground" : "text-sm text-foreground/90")}>
        {body}
      </p>
    </div>
  );
}

const PROTO_TOTALS: Record<string, number> = { reactivar: 5, invitar: 10, entender: 4, diagnostico: 4 };
