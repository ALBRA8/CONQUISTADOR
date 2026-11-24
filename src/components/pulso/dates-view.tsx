"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { api, type DateEntry, type WomanListItem } from "@/lib/pulso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton, EmptyState, fmtDateTime } from "@/components/pulso/shared";
import { CalendarDays, Compass, FileCheck, NotebookPen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Briefing = {
  tono?: string; conversar?: string[]; evitar?: string[]; escalar?: string;
  cierre?: string; frase?: string; accion?: string; recordar?: string;
};
type Debriefing = {
  veredicto?: string; senales_buenas?: string[]; senales_malas?: string[];
  siguiente?: string; mensaje?: string; cuando?: string;
};

const STATUS_TONE: Record<string, string> = {
  agendada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  hecha: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  cancelada: "border-red-500/40 bg-red-500/10 text-red-300",
  no_show: "border-red-500/40 bg-red-500/10 text-red-300",
};

// Citas: lista + calendario + informe previo + resumen posterior + modo "en la cita" (6.10)
export function DatesView() {
  const { women, womenLoaded, setView } = useAppStore();
  const [dates, setDates] = useState<DateEntry[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [inDateOpen, setInDateOpen] = useState(false);
  const [active, setActive] = useState<DateEntry | null>(null);

  async function load() {
    try {
      const data = await api<{ dates: DateEntry[] }>("/api/dates");
      setDates(data.dates);
    } catch (e) {
      toast({ title: "No se pudieron cargar las citas", description: (e as Error).message, variant: "destructive" });
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos externos
    load();
  }, []);

  const upcoming = dates.filter((d) => d.status === "agendada");
  const past = dates.filter((d) => d.status !== "agendada");

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <CalendarDays className="h-5 w-5 text-amber-400" /> Citas
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setInDateOpen(true)}>
            <Compass className="mr-1.5 h-4 w-4" /> Estoy en una cita
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={women.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" /> Agendar
          </Button>
        </div>
      </div>

      {women.length === 0 ? (
        <EmptyState
          title="Primero una ficha"
          body="Las citas se agendan sobre una ficha existente. Añade una persona antes."
          action={<Button onClick={() => setView("contacts")}>Ir a contactos</Button>}
        />
      ) : (
        <>
          <MonthCalendar dates={upcoming} />

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Próximas ({upcoming.length})</h2>
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nada agendado todavía.</p>}
            {upcoming.map((d) => (
              <DateRow key={d.id} d={d} onOpen={() => setActive(d)} onChange={load} />
            ))}
          </section>

          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Historial ({past.length})</h2>
              {past.map((d) => (
                <DateRow key={d.id} d={d} onOpen={() => setActive(d)} onChange={load} />
              ))}
            </section>
          )}
        </>
      )}

      <CreateDateDialog open={createOpen} onOpenChange={setCreateOpen} women={women} onSaved={load} />
      <InDateDialog open={inDateOpen} onOpenChange={setInDateOpen} />
      <DateDetailDialog date={active} onOpenChange={(v) => !v && setActive(null)} women={women} onChange={load} />
    </div>
  );
}

function MonthCalendar({ dates }: { dates: DateEntry[] }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // lunes primero
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const dayNames = ["L", "M", "X", "J", "V", "S", "D"];
  const hasDate = (day: number) =>
    dates.some((d) => {
      const dt = new Date(d.scheduledAt);
      return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === day;
    });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          className="rounded-md px-2 py-1 text-sm hover:bg-accent"
          onClick={() => (month === 0 ? (setMonth(11), setYear(year - 1)) : setMonth(month - 1))}
          aria-label="Mes anterior"
        >
          ←
        </button>
        <p className="text-sm font-medium capitalize">
          {first.toLocaleDateString("es", { month: "long", year: "numeric" })}
        </p>
        <button
          className="rounded-md px-2 py-1 text-sm hover:bg-accent"
          onClick={() => (month === 11 ? (setMonth(0), setYear(year + 1)) : setMonth(month + 1))}
          aria-label="Mes siguiente"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {dayNames.map((d) => (
          <span key={d} className="text-[11px] text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((c, i) => (
          <span
            key={i}
            className={cn(
              "flex h-9 items-center justify-center rounded-md text-sm",
              c === null && "",
              c !== null && hasDate(c) && "bg-amber-500/15 font-semibold text-amber-300",
              c !== null && !hasDate(c) && "text-muted-foreground",
              c !== null &&
                year === now.getFullYear() &&
                month === now.getMonth() &&
                c === now.getDate() &&
                "ring-1 ring-amber-500/50"
            )}
          >
            {c || ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function DateRow({ d, onOpen, onChange }: { d: DateEntry; onOpen: () => void; onChange: () => void }) {
  async function setStatus(status: string) {
    try {
      await api(`/api/dates/${d.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onChange();
    } catch (e) {
      toast({ title: "No se pudo actualizar", description: (e as Error).message, variant: "destructive" });
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="font-medium">{d.woman?.name || "Cita"}</p>
        <p className="text-sm text-muted-foreground">
          {fmtDateTime(d.scheduledAt)}
          {d.place ? ` · ${d.place}` : ""}
        </p>
      </button>
      <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", STATUS_TONE[d.status])}>{d.status}</span>
      {d.status === "agendada" && (
        <>
          <Button size="sm" variant="outline" onClick={() => setStatus("hecha")}>
            Se hizo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatus("cancelada")}>
            Se cayó
          </Button>
        </>
      )}
    </div>
  );
}

function CreateDateDialog({
  open,
  onOpenChange,
  women,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  women: WomanListItem[];
  onSaved: () => void;
}) {
  const [womanId, setWomanId] = useState<string>("");
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!womanId || !when) {
      toast({ title: "Faltan datos", description: "Elige persona, fecha y hora.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await api("/api/dates", {
        method: "POST",
        body: JSON.stringify({ womanId, scheduledAt: new Date(when).toISOString(), place: place.trim() || null }),
      });
      toast({ title: "Cita agendada", description: "Recuerda confirmarla el mismo día." });
      onOpenChange(false);
      setWhen("");
      setPlace("");
      onSaved();
    } catch (e) {
      toast({ title: "No se pudo agendar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar cita</DialogTitle>
          <DialogDescription>El plan es concreto: persona, día, hora y lugar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Persona</Label>
            <Select value={womanId} onValueChange={setWomanId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige…" />
              </SelectTrigger>
              <SelectContent>
                {women.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-when">Fecha y hora</Label>
            <Input id="date-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-place">Lugar</Label>
            <Input id="date-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Café, bar, paseo…" />
          </div>
        </div>
        <Button className="w-full" onClick={save} disabled={busy}>
          {busy ? "Agendando…" : "Agendar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function DateDetailDialog({
  date,
  onOpenChange,
  women,
  onChange,
}: {
  date: DateEntry | null;
  onOpenChange: (v: boolean) => void;
  women: WomanListItem[];
  onChange: () => void;
}) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [debriefing, setDebriefing] = useState<Debriefing | null>(null);
  const [relato, setRelato] = useState("");
  const [busyBrief, setBusyBrief] = useState(false);
  const [busyDebrief, setBusyDebrief] = useState(false);

  useEffect(() => {
    if (date) {
      try {
        setBriefing(date.preBriefing ? (JSON.parse(date.preBriefing) as Briefing) : null);
        setDebriefing(date.debriefing ? (JSON.parse(date.debriefing) as Debriefing) : null);
      } catch {
        setBriefing(null);
        setDebriefing(null);
      }
      setRelato("");
    }
  }, [date?.id]);

  async function makeBrief() {
    if (!date) return;
    setBusyBrief(true);
    try {
      const res = await api<{ briefing: Briefing }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "date_brief", dateId: date.id }),
      });
      setBriefing(res.briefing);
      onChange();
    } catch (e) {
      toast({ title: "El informe no salió", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyBrief(false);
    }
  }

  async function makeDebrief() {
    if (!date) return;
    setBusyDebrief(true);
    try {
      const res = await api<{ debriefing: Debriefing }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "date_debrief", dateId: date.id, relato }),
      });
      setDebriefing(res.debriefing);
      onChange();
    } catch (e) {
      toast({ title: "El resumen no salió", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyDebrief(false);
    }
  }

  return (
    <Dialog open={Boolean(date)} onOpenChange={onOpenChange}>
      <DialogContent className="pulso-scroll max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {date && (
          <>
            <DialogHeader>
              <DialogTitle>Cita con {date.woman?.name}</DialogTitle>
              <DialogDescription>
                {fmtDateTime(date.scheduledAt)}
                {date.place ? ` · ${date.place}` : ""} · estado: {date.status}
              </DialogDescription>
            </DialogHeader>

            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <FileCheck className="h-4 w-4 text-amber-400" /> Informe previo
              </h3>
              {briefing ? (
                <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
                  {briefing.tono && <p><span className="font-medium">Ánimo de llegada: </span>{briefing.tono}</p>}
                  {briefing.conversar && (
                    <div>
                      <p className="font-medium">Qué conversar</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                        {briefing.conversar.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {briefing.evitar && (
                    <div>
                      <p className="font-medium">Qué evitar</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                        {briefing.evitar.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {briefing.escalar && <p><span className="font-medium">Escalar: </span>{briefing.escalar}</p>}
                  {briefing.cierre && <p><span className="font-medium">Cierre: </span>{briefing.cierre}</p>}
                  {briefing.frase && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary p-3">
                      <p className="min-w-0 flex-1">"{briefing.frase}"{briefing.accion ? ` — ${briefing.accion}` : ""}</p>
                      <CopyButton text={briefing.frase} />
                    </div>
                  )}
                  {briefing.recordar && <p className="text-xs text-muted-foreground">{briefing.recordar}</p>}
                </div>
              ) : (
                <Button variant="outline" onClick={makeBrief} disabled={busyBrief}>
                  {busyBrief ? "Preparando…" : "Generar informe previo"}
                </Button>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <NotebookPen className="h-4 w-4 text-amber-400" /> Resumen posterior
              </h3>
              {debriefing ? (
                <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
                  <p>{debriefing.veredicto}</p>
                  {debriefing.senales_buenas && (
                    <div>
                      <p className="font-medium text-emerald-300">Señales buenas</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                        {debriefing.senales_buenas.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {debriefing.senales_malas && (
                    <div>
                      <p className="font-medium text-red-300">Señales malas</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                        {debriefing.senales_malas.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {debriefing.siguiente && <p><span className="font-medium">Siguiente movimiento: </span>{debriefing.siguiente}</p>}
                  {debriefing.mensaje && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary p-3">
                      <p className="min-w-0 flex-1">{debriefing.mensaje}</p>
                      <CopyButton text={debriefing.mensaje} />
                    </div>
                  )}
                  {debriefing.cuando && <p className="text-xs text-muted-foreground">Enviar {debriefing.cuando}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="debrief">¿Cómo fue? (2-10 líneas)</Label>
                  <Textarea id="debrief" rows={4} value={relato} onChange={(e) => setRelato(e.target.value)} />
                  <Button variant="outline" onClick={makeDebrief} disabled={busyDebrief || !relato.trim()}>
                    {busyDebrief ? "Analizando…" : "Generar resumen"}
                  </Button>
                </div>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InDateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [situation, setSituation] = useState("");
  const [advice, setAdvice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const res = await api<{ advice: string }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "in_date", situation }),
      });
      setAdvice(res.advice);
    } catch (e) {
      toast({ title: "Sin respuesta ahora", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Estás en la cita ahora</DialogTitle>
          <DialogDescription>
            Cuenta en una línea qué está pasando y te doy la guía del momento: qué hacer, qué decir, cómo leer la escena.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Ej: ya pedimos y el silencio se alarga…"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
          />
          <Button className="w-full" onClick={ask} disabled={busy || !situation.trim()}>
            {busy ? "Pensando…" : "Qué hago ahora"}
          </Button>
          {advice && <p className="whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm">{advice}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
