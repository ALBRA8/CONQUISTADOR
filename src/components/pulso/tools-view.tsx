"use client";

import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/pulso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton, EmptyState } from "@/components/pulso/shared";
import { FileSearch, SlidersHorizontal, Wand2, Stethoscope } from "lucide-react";

// Herramientas v2: análisis profundo · primeros mensajes · tono · diagnóstico 30/60/90
export function ToolsView() {
  const { women, setView } = useAppStore();
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold tracking-tight">Herramientas</h1>
      <Tabs defaultValue="profundo">
        <TabsList className="pulso-scroll grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="profundo" className="gap-1.5">
            <FileSearch className="h-3.5 w-3.5" /> Profundo
          </TabsTrigger>
          <TabsTrigger value="bio" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> Por bio
          </TabsTrigger>
          <TabsTrigger value="tono" className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Tono
          </TabsTrigger>
          <TabsTrigger value="diagnostico" className="gap-1.5">
            <Stethoscope className="h-3.5 w-3.5" /> Diagnóstico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profundo" className="pt-4">
          <DeepAnalysisTool />
        </TabsContent>
        <TabsContent value="bio" className="pt-4">
          <BioTool />
        </TabsContent>
        <TabsContent value="tono" className="pt-4">
          <ToneTool />
        </TabsContent>
        <TabsContent value="diagnostico" className="pt-4">
          {women.length === 0 ? <DiagnosticTool /> : <DiagnosticTool />}
        </TabsContent>
      </Tabs>
      {women.length === 0 && (
        <EmptyState
          title="Consejo"
          body="Las herramientas funcionan mejor con fichas y conversaciones guardadas. Añade una persona y verás cómo cambia todo."
          action={<Button variant="outline" onClick={() => setView("contacts")}>Ir a contactos</Button>}
        />
      )}
    </div>
  );
}

function DeepAnalysisTool() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    lectura?: string; mensaje?: string; por_que?: string; cuando?: string; evitar?: string; parece_real?: string;
  } | null>(null);

  async function analyze() {
    setBusy(true);
    try {
      const res = await api<{ analysis: NonNullable<typeof result> }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "deep", text }),
      });
      setResult(res.analysis);
    } catch (e) {
      toast({ title: "No se pudo analizar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pega una conversación completa (hasta 12.000 caracteres) sin ficha previa. Útil para revistas de un chat entero en un momento.
      </p>
      <Textarea
        rows={8}
        className="pulso-scroll"
        placeholder={"ELLA: …\nTÚ: …\nELLA: …"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground">{text.length}/12000</span>
        <Button onClick={analyze} disabled={busy || !text.trim()}>
          {busy ? "Analizando a fondo…" : "Analizar"}
        </Button>
      </div>
      {result && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          <p>{result.lectura}</p>
          {result.mensaje && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary p-3">
              <p className="min-w-0 flex-1">{result.mensaje}</p>
              <CopyButton text={result.mensaje} />
            </div>
          )}
          {result.por_que && <p className="text-muted-foreground"><span className="font-medium text-foreground">Por qué funciona: </span>{result.por_que}</p>}
          {result.cuando && <p className="text-muted-foreground"><span className="font-medium text-foreground">Cuándo: </span>{result.cuando}</p>}
          {result.evitar && <p className="text-muted-foreground"><span className="font-medium text-foreground">Qué evitar: </span>{result.evitar}</p>}
          {result.parece_real && (
            <Badge variant={result.parece_real === "sí" || result.parece_real === "si" ? "secondary" : "outline"}>
              Conversación {result.parece_real === "sí" || result.parece_real === "si" ? "plausible" : "dudosa"}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function BioTool() {
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<Array<{ tipo?: string; texto?: string; ventaja?: string; riesgo?: string }> | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const res = await api<{ opciones: NonNullable<typeof opts> }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "first_messages", bio }),
      });
      setOpts(res.opciones);
    } catch (e) {
      toast({ title: "No salieron los mensajes", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const tipoLabel: Record<string, string> = { observacion: "Observación", desafio: "Desafío", pregunta: "Pregunta" };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Pega la bio (app de citas o perfil) y escribe tres aperturas distintas: observación, desafío y pregunta. Solo con lo que dice la bio, sin halagos físicos.</p>
      <Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Ej: Me gusta la montaña, el cine de terror y aprendo a cocinar ramen…" />
      <Button onClick={generate} disabled={busy || !bio.trim()}>
        {busy ? "Escribiendo…" : "Escribir 3 aperturas"}
      </Button>
      {opts && (
        <div className="grid gap-3 lg:grid-cols-3">
          {opts.map((o, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
              <Badge variant="secondary">{tipoLabel[o.tipo || ""] || o.tipo || `Opción ${i + 1}`}</Badge>
              <p className="rounded-md bg-secondary p-3">{o.texto}</p>
              {o.ventaja && <p className="text-xs text-muted-foreground"><span className="text-emerald-300 font-medium">Ventaja: </span>{o.ventaja}</p>}
              {o.riesgo && <p className="text-xs text-muted-foreground"><span className="text-red-300 font-medium">Riesgo: </span>{o.riesgo}</p>}
              <CopyButton text={o.texto || ""} className="w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TONES = ["misterioso", "coqueto", "casual", "suave", "atrevido", "divertido", "romantico", "directo"];

function ToneTool() {
  const [text, setText] = useState("");
  const [tone, setTone] = useState("casual");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ texto?: string; caracteres?: number } | null>(null);

  async function rewrite() {
    setBusy(true);
    try {
      const res = await api<{ texto: string; caracteres: number }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "tone", text, tone }),
      });
      setResult(res);
    } catch (e) {
      toast({ title: "No se pudo reescribir", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Reescribe un mensaje en uno de los ocho tonos, conservando la intención. Jamás añade presión ni coerción.</p>
      <div className="space-y-1.5">
        <Label htmlFor="tone-text">Mensaje</Label>
        <Textarea id="tone-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {TONES.map((t) => (
          <button
            key={t}
            onClick={() => setTone(t)}
            className={`rounded-full border border-border px-3 py-1 text-xs capitalize ${tone === t ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <Button onClick={rewrite} disabled={busy || !text.trim()}>
        {busy ? "Reescribiendo…" : "Reescribir"}
      </Button>
      {result?.texto && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm">
          <p className="min-w-0 flex-1">{result.texto}</p>
          <span className="font-mono text-xs text-muted-foreground">{result.caracteres} car.</span>
          <CopyButton text={result.texto} />
        </div>
      )}
    </div>
  );
}

const AREAS = [
  { id: "resultados", label: "Resultados con mujeres" },
  { id: "fisico_salud", label: "Físico y salud" },
  { id: "imagen", label: "Imagen y presencia" },
  { id: "profesion", label: "Desarrollo profesional" },
  { id: "social", label: "Vida social" },
  { id: "mentalidad", label: "Mentalidad y hábitos" },
  { id: "digital", label: "Presencia digital" },
];

function DiagnosticTool() {
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries(AREAS.map((a) => [a.id, 5])));
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{
    banda?: string; nivel_global?: number; revision?: string;
    plan?: Array<{ semana: number; acciones: string[] }>;
  } | null>(null);

  async function build() {
    setBusy(true);
    try {
      const res = await api<{ plan: NonNullable<typeof plan> }>("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          action: "diagnostic",
          areas: AREAS.map((a) => ({ nombre: a.id, nota: scores[a.id] })),
        }),
      });
      setPlan(res.plan);
    } catch (e) {
      toast({ title: "El plan no salió", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Puntúa tus siete áreas del 1 al 10. El coach arma tu nivel global con una banda propia y un plan de 12 semanas con revisión a 15 días. Guárdalo: sin él no podrás comparar tu avance.
      </p>
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        {AREAS.map((a) => (
          <div key={a.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span>{a.label}</span>
              <span className="font-mono text-muted-foreground">{scores[a.id]}/10</span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[scores[a.id]]}
              onValueChange={(v) => setScores({ ...scores, [a.id]: v[0] })}
              aria-label={a.label}
            />
          </div>
        ))}
      </div>
      <Button onClick={build} disabled={busy}>
        {busy ? "Armando tu plan…" : "Generar plan 30/60/90"}
      </Button>
      {plan && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Nivel global: {plan.nivel_global}/10</Badge>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">{plan.banda}</Badge>
          </div>
          <div className="space-y-2">
            {plan.plan?.map((p) => (
              <details key={p.semana} className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Semana {p.semana}</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                  {p.acciones.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </details>
            ))}
          </div>
          {plan.revision && <p className="text-xs text-muted-foreground">Revisión sugerida: {plan.revision}</p>}
        </div>
      )}
    </div>
  );
}
