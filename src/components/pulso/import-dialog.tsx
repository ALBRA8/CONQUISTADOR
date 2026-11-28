"use client";

import { useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/pulso";
import { AlertTriangle, Check, FileText, Image as ImageIcon, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

type Draft = { sender: "me" | "her"; body: string; sentAt: string | null; hora?: string | null; confidence?: number | null };
// Borrador del .txt: conserva el nombre crudo del autor hasta que el usuario
// dice quién es; el emisor final (me/her) se decide al confirmar.
type TxtDraft = { author: string; body: string; sentAt: string | null };

// Importación en tres caminos (sección 6.6): capturas · .txt · manual
export function ImportDialog({
  open,
  onOpenChange,
  womanId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  womanId: string;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pulso-scroll max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar conversación</DialogTitle>
          <DialogDescription>
            Nada se escribe por ti: Pulso solo guarda la copia. Revisa y corrige antes de guardar.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="capturas">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="capturas" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> Capturas
            </TabsTrigger>
            <TabsTrigger value="txt" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Archivo .txt
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" /> Escribir
            </TabsTrigger>
          </TabsList>
          <TabsContent value="capturas">
            <ScreenshotsTab womanId={womanId} onSaved={() => { onSaved(); onOpenChange(false); }} />
          </TabsContent>
          <TabsContent value="txt">
            <TxtTab womanId={womanId} onSaved={() => { onSaved(); onOpenChange(false); }} />
          </TabsContent>
          <TabsContent value="manual">
            <ManualTab womanId={womanId} onSaved={() => { onSaved(); onOpenChange(false); }} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------- A) CAPTURAS ----------

function ScreenshotsTab({ womanId, onSaved }: { womanId: string; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    setError(null);
    if (!files || files.length === 0) return;
    if (files.length > 5) return setError("Máximo 5 capturas por lote.");
    setBusy(true);
    try {
      const images: string[] = [];
      for (const f of Array.from(files)) {
        const dataUrl = await readAsDataUrl(f);
        images.push(dataUrl);
      }
      const res = await api<{ ok: boolean; messages: Draft[] }>("/api/import/screenshots", {
        method: "POST",
        body: JSON.stringify({ images }),
      });
      setDraft(res.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    setBusy(true);
    try {
      await api("/api/import/save", {
        method: "POST",
        body: JSON.stringify({ womanId, source: "screenshot", messages: draft }),
      });
      toast({ title: "Conversación guardada", description: `${draft.length} mensajes revisados y guardados.` });
      setDraft(null);
      onSaved();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (draft) {
    return (
      <div className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Revisa quién dijo qué antes de guardar. Las filas en ámbar llegaron con lectura dudosa.
        </p>
        <div className="pulso-scroll max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
          {draft.map((d, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2 text-sm",
                (d.confidence ?? 1) < 0.6 ? "border-amber-500/40 bg-amber-500/5" : "border-border"
              )}
            >
              <button
                className="shrink-0 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-semibold"
                onClick={() => setDraft(draft.map((x, j) => (j === i ? { ...x, sender: x.sender === "me" ? "her" : "me" } : x)))}
                aria-label="Cambiar emisor"
              >
                {d.sender === "me" ? "YO" : "ELLA"}
              </button>
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                value={d.body}
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
              />
              <input
                className="w-16 shrink-0 bg-transparent text-center text-xs text-muted-foreground outline-none"
                value={d.hora || ""}
                placeholder="hora"
                onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, hora: e.target.value || null } : x)))}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => setDraft(null)}>
            Descartar lectura
          </Button>
          <Button onClick={confirm} disabled={busy}>
            <Check className="mr-1.5 h-4 w-4" /> Confirmar y guardar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Sube una o varias capturas (derecha = tú, izquierda = ella). La IA las lee y te muestra la lista para confirmar.
        </p>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? "Leyendo capturas…" : "Elegir capturas"}
        </Button>
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">¿Resultado confuso? El archivo .txt es más fiable.</p>
      </div>
    </div>
  );
}

// ---------- B) ARCHIVO .TXT ----------

function TxtTab({ womanId, onSaved }: { womanId: string; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [authors, setAuthors] = useState<string[]>([]);
  const [parsed, setParsed] = useState<TxtDraft[] | null>(null);
  const [meAuthor, setMeAuthor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; authors: string[]; messages: Array<{ sender: string; body: string; sentAt: string | null }> }>(
        "/api/import/txt",
        { method: "POST", body: JSON.stringify({ text }) }
      );
      setAuthors(res.authors);
      // OJO: el parser devuelve el NOMBRE del autor en "sender". No convertir
      // a me/her aquí: se decide con meAuthor al confirmar (antes todos caían
      // en "her" y se importaban mal).
      setParsed(res.messages.map((m) => ({ author: m.sender, body: m.body, sentAt: m.sentAt })));
      setMeAuthor(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!parsed || !meAuthor) return;
    setBusy(true);
    try {
      const authorMap: Record<string, string> = {};
      for (const a of authors) authorMap[a] = a === meAuthor ? "me" : "her";
      const messages = parsed.map((d) => ({
        sender: (d.author === meAuthor ? "me" : "her") as "me" | "her",
        author: d.author,
        body: d.body,
        sentAt: d.sentAt,
      }));
      await api("/api/import/save", {
        method: "POST",
        body: JSON.stringify({ womanId, source: "txt_import", messages, authorMap }),
      });
      toast({ title: "Conversación guardada", description: `${parsed.length} mensajes importados.` });
      setParsed(null);
      setText("");
      setMeAuthor(null);
      onSaved();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (parsed) {
    return (
      <div className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <Label>
            ¿Quién eres tú en el archivo? <span className="text-amber-300">(elige tu nombre para activar el guardado)</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {authors.map((a) => (
              <button
                key={a}
                onClick={() => setMeAuthor(a)}
                className={cn(
                  "rounded-full border border-border px-3 py-1 text-sm",
                  meAuthor === a && "border-amber-500/50 bg-amber-500/10 text-amber-300"
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="pulso-scroll max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-3 text-sm">
          {parsed.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground">
                {d.sentAt ? new Date(d.sentAt).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "sin hora"}
              </span>
              <span
                className={cn(
                  "w-12 shrink-0 truncate text-[10px] font-bold",
                  !meAuthor
                    ? "text-muted-foreground"
                    : d.author === meAuthor
                      ? "text-amber-300"
                      : "text-muted-foreground"
                )}
                title={d.author}
              >
                {!meAuthor ? d.author : d.author === meAuthor ? "YO" : "ELLA"}
              </span>
              <span className="min-w-0 whitespace-pre-wrap break-words">{d.body}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setParsed(null)}>Volver</Button>
          <div className="flex items-center gap-3">
            {!meAuthor && (
              <p className="text-xs text-muted-foreground">Primero toca tu nombre arriba para poder guardar.</p>
            )}
            <Button onClick={confirm} disabled={busy || !meAuthor}>
              <Check className="mr-1.5 h-4 w-4" /> Guardar {parsed.length} mensajes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">
        Exporta el chat desde WhatsApp (con archivos adjuntos desactivados) y pega o sube el .txt. El parseo es local: solo va a la IA lo que no se pueda leer aquí, y normalmente nada.
      </p>
      <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) setText(await f.text());
      }} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => fileRef.current?.click()}>Elegir archivo .txt</Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="txt-area">…o pega el contenido</Label>
        <textarea
          id="txt-area"
          className="pulso-scroll h-40 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          placeholder={'12/03/2024, 21:34 - Nombre: mensaje…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={parse} disabled={busy || !text.trim()}>
        {busy ? "Analizando…" : "Analizar archivo"}
      </Button>
    </div>
  );
}

// ---------- C) MANUAL ----------

function ManualTab({ womanId, onSaved }: { womanId: string; onSaved: () => void }) {
  const [mine, setMine] = useState("");
  const [hers, setHers] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  async function addPair() {
    if (!mine.trim() && !hers.trim()) return;
    setBusy(true);
    try {
      const messages: Draft[] = [];
      if (mine.trim()) messages.push({ sender: "me", body: mine.trim(), sentAt: when ? new Date(when).toISOString() : null });
      if (hers.trim()) messages.push({ sender: "her", body: hers.trim(), sentAt: when ? new Date(new Date(when).getTime() + 60000).toISOString() : null });
      await api(`/api/women/${womanId}/messages`, { method: "POST", body: JSON.stringify({ messages }) });
      setMine("");
      setHers("");
      toast({ title: "Mensajes añadidos" });
      onSaved();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">Escribe los mensajes a mano, en orden. El campo de hora es importante: con hora, Pulso puede sugerir cuándo enviar.</p>
      <div className="space-y-1.5">
        <Label htmlFor="m-mine">Tú escribiste</Label>
        <Input id="m-mine" value={mine} onChange={(e) => setMine(e.target.value)} placeholder="Tu mensaje…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-hers">Ella respondió</Label>
        <Input id="m-hers" value={hers} onChange={(e) => setHers(e.target.value)} placeholder="Su mensaje…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-when">Hora de tu mensaje</Label>
        <Input id="m-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>
      <Button className="w-full" onClick={addPair} disabled={busy || (!mine.trim() && !hers.trim())}>
        {busy ? "Guardando…" : "Añadir al historial"}
      </Button>
      <Button variant="ghost" className="w-full" onClick={onSaved} disabled={busy}>
        Terminar
      </Button>
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
