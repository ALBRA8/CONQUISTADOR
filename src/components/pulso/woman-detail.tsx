"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { api, type AnalysisRow, type DateEntry, type Message, type Woman } from "@/lib/pulso";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyButton, EstimationNotice, Meter, StatusChip, fmtDateTime } from "@/components/pulso/shared";
import { Conversation } from "@/components/pulso/conversation";
import { CoachThreadPanel } from "@/components/pulso/coach-thread";
import { WomanFormDialog } from "@/components/pulso/woman-form";
import {
  Archive,
  ExternalLink,
  Pencil,
  Radar,
  RefreshCw,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";

type Detail = {
  woman: Woman;
  messages: Message[];
  analyses: AnalysisRow[];
  dates: DateEntry[];
  suggestions: Array<{ id: string; options: string; chosenIndex: number | null; sentAt: string | null; outcome: string | null; createdAt: string }>;
  thread: { id: string; protocol: string; step: number } | null;
};

export function WomanDetail({ id }: { id: string }) {
  const { setView } = useAppStore();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<Detail>(`/api/women/${id}`);
      setDetail(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos externos
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-destructive">
        {error}{" "}
        <Button variant="outline" size="sm" onClick={load}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!detail) {
    return <div className="space-y-4 p-6 text-sm text-muted-foreground">Cargando ficha…</div>;
  }

  const w = detail.woman;
  const radiografia = detail.analyses.find((a) => a.kind === "radiografia");

  async function archive() {
    try {
      await api(`/api/women/${w.id}`, { method: "DELETE" });
      toast({ title: "Ficha archivada", description: "No se borra nada: puedes restaurarla pidiéndonlo." });
      setView("contacts");
    } catch (e) {
      toast({ title: "No se pudo archivar", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5 p-4">
      <button onClick={() => setView("contacts")} className="text-sm text-muted-foreground hover:text-foreground">
        ← Contactos
      </button>

      {/* Cabecera */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border border-border">
            {w.photo ? <AvatarImage src={w.photo} alt={`Foto de ${w.name}`} /> : null}
            <AvatarFallback className="bg-secondary text-xl font-semibold">{w.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{w.name}</h1>
              {w.age && <span className="text-muted-foreground">· {w.age} años</span>}
              <StatusChip status={w.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[w.city, w.occupation, w.archetype].filter(Boolean).join(" · ") || "Completa la ficha para dar más contexto al coach"}
            </p>
            <div className="mt-2 max-w-xs">
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Interés estimado</span>
                <span className="font-mono font-semibold text-foreground">{w.interestLevel}/100</span>
              </div>
              <Progress value={w.interestLevel} className="mt-1 h-1.5" aria-label="Interés estimado" />
              <EstimationNotice>
                Interés actualizado por la IA tras cada análisis. Es una lectura del texto, no una medición real.
              </EstimationNotice>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
          </Button>
          {w.phone && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://wa.me/${w.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir WhatsApp
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setArchiveOpen(true)}>
            <Archive className="mr-1.5 h-3.5 w-3.5" /> Archivar
          </Button>
        </div>
        {w.metWhere && (
          <p className="text-sm text-muted-foreground">
            Se conocieron: <span className="text-foreground">{w.metWhere}</span>
          </p>
        )}
        {w.notes && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            Notas: <span className="text-foreground">{w.notes}</span>
          </p>
        )}
      </div>

      <Tabs defaultValue="historial">
        <TabsList className="pulso-scroll grid w-full grid-cols-3 sm:grid-cols-5">
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="coach">Coach</TabsTrigger>
          <TabsTrigger value="radiografia">Radiografía</TabsTrigger>
          <TabsTrigger value="opciones">Opciones</TabsTrigger>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="pt-4">
          <Conversation womanId={w.id} messages={detail.messages} onChange={load} />
        </TabsContent>

        <TabsContent value="coach" className="pt-4">
          <CoachThreadPanel
            woman={w}
            thread={detail.thread}
            messages={detail.messages}
            onActivity={load}
          />
        </TabsContent>

        <TabsContent value="radiografia" className="pt-4">
          <RadiografiaPanel womanId={w.id} analysis={radiografia || null} onDone={load} />
        </TabsContent>

        <TabsContent value="opciones" className="pt-4">
          <OptionsPanel womanId={w.id} />
        </TabsContent>

        <TabsContent value="perfil" className="pt-4">
          <PerfilPanel womanId={w.id} archetype={w.archetype} onDone={load} />
        </TabsContent>
      </Tabs>

      <WomanFormDialog open={editOpen} onOpenChange={setEditOpen} editing={w} onSaved={load} />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar esta ficha?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                La ficha y su historial se ocultan de tu lista, pero no se borra nada. Archivar es reversible.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={archive}>Archivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- Radiografía ----------

type Metrics = {
  interes?: number; atraccion?: number; comodidad?: number; deseo_verte?: number; prob_cita?: number;
  estado?: string; tendencia?: string; momento_cita?: string; motivo?: string;
};

function RadiografiaPanel({
  womanId,
  analysis,
  onDone,
}: {
  womanId: string;
  analysis: AnalysisRow | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(() => {
    try {
      return analysis?.metrics ? (JSON.parse(analysis.metrics) as Metrics) : null;
    } catch {
      return null;
    }
  });
  const [created, setCreated] = useState<string>(analysis?.createdAt || "");
  const { refreshQuota } = useAppStore();

  async function analyze() {
    setBusy(true);
    try {
      const res = await api<{ metrics: Metrics }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "analyze", womanId }),
      });
      setMetrics(res.metrics);
      setCreated(new Date().toISOString());
      onDone();
      toast({ title: "Radiografía lista" });
    } catch (e) {
      const err = e as Error & { code?: string };
      toast({ title: "No se pudo analizar", description: err.message, variant: "destructive" });
    } finally {
      refreshQuota((s) => s);
      setBusy(false);
    }
  }

  const estadoLabel: Record<string, string> = {
    frio: "Frío", tibio: "Tibio", caliente: "Caliente", sinrespuesta: "Sin respuesta",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        {metrics ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium">Última lectura {created && `· ${fmtDateTime(created)}`}</p>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">estimación de la IA</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Meter label="Interés" value={metrics.interes || 0} />
              <Meter label="Atracción" value={metrics.atraccion || 0} tone="red" />
              <Meter label="Comodidad" value={metrics.comodidad || 0} tone="green" />
              <Meter label="Deseo de verte" value={metrics.deseo_verte || 0} />
              <Meter label="Probabilidad de cita" value={metrics.prob_cita || 0} tone="green" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {metrics.estado && (
                <Badge variant="secondary">Estado: {estadoLabel[metrics.estado] || metrics.estado}</Badge>
              )}
              {metrics.tendencia && <Badge variant="secondary">Tendencia: {metrics.tendencia}</Badge>}
              {metrics.momento_cita && (
                <Badge variant="secondary">
                  Momento de invitar: {metrics.momento_cita === "esperar" ? "esperar" : metrics.momento_cita === "ideal" ? "ideal" : "tarde"}
                </Badge>
              )}
            </div>
            {metrics.motivo && (
              <p className="mt-4 rounded-md bg-secondary p-3 text-sm">
                <span className="font-medium">Por qué estos números: </span>
                {metrics.motivo}
              </p>
            )}
            <div className="mt-4">
              <EstimationNotice />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no hay radiografía. Analiza el último mensaje de ella: 5 medidores 0-100 con su explicación.
          </p>
        )}
      </div>
      <Button onClick={analyze} disabled={busy}>
        {busy ? (
          <>
            <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> Leyendo el historial…
          </>
        ) : (
          <>
            <Radar className="mr-1.5 h-4 w-4" /> {metrics ? "Reanalizar último mensaje" : "Analizar último mensaje"}
          </>
        )}
      </Button>
    </div>
  );
}

// ---------- Tres opciones ----------

type Option = {
  texto?: string; tipo?: string; caracteres?: number; prob_exito?: number;
  ventaja?: string; riesgo?: string; cuando_enviar?: string; mejor_si?: string; evitar_si?: string;
};

function OptionsPanel({ womanId }: { womanId: string }) {
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<Option[] | null>(null);
  const { refreshQuota } = useAppStore();

  async function generate() {
    setBusy(true);
    try {
      const res = await api<{ opciones: Option[] }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "options", womanId }),
      });
      setOpts(res.opciones);
    } catch (e) {
      toast({ title: "No salieron las opciones", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const tipoLabel: Record<string, string> = { casual: "Casual", con_gancho: "Con gancho", que_avanza: "Que avanza" };

  return (
    <div className="space-y-4">
      <Button onClick={generate} disabled={busy}>
        {busy ? (
          <>
            <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> Pensando tres caminos distintos…
          </>
        ) : (
          <>
            <Sparkles className="mr-1.5 h-4 w-4" /> {opts ? "Pedir tres nuevas" : "Generar 3 opciones"}
          </>
        )}
      </Button>
      {opts && (
        <div className="grid gap-3 lg:grid-cols-3">
          {opts.map((o, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{tipoLabel[o.tipo || ""] || o.tipo || `Opción ${i + 1}`}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{o.caracteres || (o.texto || "").length} car.</span>
              </div>
              <p className="rounded-md bg-secondary p-3 text-sm leading-snug">{o.texto}</p>
              {o.cuando_enviar && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Cuándo: </span>
                  {o.cuando_enviar}
                </p>
              )}
              {o.ventaja && <p className="text-xs text-muted-foreground"><span className="font-medium text-emerald-300">Ventaja: </span>{o.ventaja}</p>}
              {o.riesgo && <p className="text-xs text-muted-foreground"><span className="font-medium text-red-300">Riesgo: </span>{o.riesgo}</p>}
              {o.mejor_si && <p className="text-xs text-muted-foreground"><span className="font-medium">Mejor si: </span>{o.mejor_si}</p>}
              {o.evitar_si && <p className="text-xs text-muted-foreground"><span className="font-medium">Evitar si: </span>{o.evitar_si}</p>}
              <CopyButton text={o.texto || ""} className="w-full" />
            </div>
          ))}
        </div>
      )}
      <EstimationNotice>
        La probabilidad de éxito de cada opción es una estimación de la IA. Las únicas cifras reales son las de tu cuenta.
      </EstimationNotice>
    </div>
  );
}

// ---------- Perfil de personalidad ----------

function PerfilPanel({ womanId, archetype, onDone }: { womanId: string; archetype: string | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<{
    arquetipo?: string; nivel_interes?: number; marcadores?: string[]; detonantes?: string[]; confianza?: string;
  } | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const res = await api<{ profile: NonNullable<typeof profile> }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "profile", womanId }),
      });
      setProfile(res.profile);
      onDone();
    } catch (e) {
      toast({ title: "El perfil no salió", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={generate} disabled={busy}>
        {busy ? (
          <>
            <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> Leyendo el historial…
          </>
        ) : (
          <>
            <UserRoundSearch className="mr-1.5 h-4 w-4" /> {archetype ? "Rehacer perfil" : "Generar perfil de personalidad"}
          </>
        )}
      </Button>
      {(profile || archetype) && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <p className="text-lg font-semibold tracking-tight">
            {profile?.arquetipo || archetype}
          </p>
          {profile?.confianza && (
            <Badge variant="secondary">Confianza del análisis: {profile.confianza}</Badge>
          )}
          {profile?.marcadores && (
            <div>
              <p className="text-sm font-medium">Marcadores observados</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {profile.marcadores.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {profile?.detonantes && (
            <div>
              <p className="text-sm font-medium">Detonantes que la activan</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {profile.detonantes.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <EstimationNotice />
        </div>
      )}
    </div>
  );
}
