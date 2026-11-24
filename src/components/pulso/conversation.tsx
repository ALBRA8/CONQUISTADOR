"use client";

import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, ArrowLeftRight, Import, MoreVertical, Pencil, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import { api, type Message } from "@/lib/pulso";
import { ImportDialog } from "@/components/pulso/import-dialog";
import { fmtDateTime } from "@/components/pulso/shared";
import { cn } from "@/lib/utils";

export function Conversation({
  womanId,
  messages,
  onChange,
}: {
  womanId: string;
  messages: Message[];
  onChange: () => void;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [editMsg, setEditMsg] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editAt, setEditAt] = useState("");
  const [invertOpen, setInvertOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<Message | null>(null);
  const [invertRangeMode, setInvertRangeMode] = useState<"all" | "range">("all");

  const missingTimes = messages.some((m) => !m.sentAt);

  async function invert() {
    try {
      await api(`/api/women/${womanId}/messages/invert`, {
        method: "POST",
        body: JSON.stringify(
          invertRangeMode === "range" && from !== "" && to !== ""
            ? { fromIndex: Number(from) - 1, toIndex: Number(to) - 1 }
            : {}
        ),
      });
      toast({ title: "Sentido corregido", description: "Los emisores quedaron invertidos en el rango elegido." });
      setInvertOpen(false);
      onChange();
    } catch (e) {
      toast({ title: "No se pudo invertir", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function saveEdit() {
    if (!editMsg) return;
    try {
      await api(`/api/messages/${editMsg.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          body: editBody,
          sentAt: editAt ? new Date(editAt).toISOString() : null,
        }),
      });
      setEditMsg(null);
      onChange();
    } catch (e) {
      toast({ title: "No se pudo editar", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function swapSender(msg: Message) {
    try {
      await api(`/api/messages/${msg.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sender: msg.sender === "me" ? "her" : "me" }),
      });
      onChange();
    } catch (e) {
      toast({ title: "No se pudo cambiar el emisor", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function removeMsg() {
    if (!deleteMsg) return;
    try {
      await api(`/api/messages/${deleteMsg.id}`, { method: "DELETE" });
      setDeleteMsg(null);
      onChange();
    } catch (e) {
      toast({ title: "No se pudo borrar", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {messages.length} mensaje{messages.length === 1 ? "" : "s"} · copia local de tu conversación
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setInvertOpen(true)} disabled={messages.length === 0}>
            <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Corregir sentido
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Import className="mr-1.5 h-3.5 w-3.5" /> Importar
          </Button>
        </div>
      </div>

      {missingTimes && messages.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Hay mensajes sin hora. Sin hora no se puede sugerir cuándo enviar: edita el mensaje y ponle fecha y hora.
        </div>
      )}

      {messages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay conversación todavía. Importa capturas, un archivo .txt de WhatsApp o escribe los mensajes a mano.
        </div>
      ) : (
        <div className="pulso-scroll max-h-[60vh] space-y-2 overflow-y-auto rounded-lg border border-border bg-background/50 p-3">
          {messages.map((m, idx) => (
            <div key={m.id} className={cn("group flex", m.sender === "me" ? "justify-end" : "justify-start")}>
              <div className={cn("relative max-w-[85%] sm:max-w-[70%]")}>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm leading-snug",
                    m.sender === "me"
                      ? "rounded-br-sm bg-amber-600/90 text-primary-foreground"
                      : "rounded-bl-sm bg-secondary text-secondary-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <div
                  className={cn(
                    "mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground",
                    m.sender === "me" ? "justify-end" : "justify-start"
                  )}
                >
                  <span>{fmtDateTime(m.sentAt)}</span>
                  {m.source !== "manual" && <span>· {m.source === "screenshot" ? "captura" : "txt"}</span>}
                  {m.confidence !== null && m.confidence < 0.6 && (
                    <span className="text-amber-400">· lectura dudosa</span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        aria-label={`Opciones del mensaje ${idx + 1}`}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={m.sender === "me" ? "end" : "start"}>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditMsg(m);
                          setEditBody(m.body);
                          setEditAt(m.sentAt ? toLocalInput(m.sentAt) : "");
                        }}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => swapSender(m)}>
                        {m.sender === "me" ? (
                          <>
                            <ArrowUp className="mr-2 h-3.5 w-3.5" /> Marcar como de ella
                          </>
                        ) : (
                          <>
                            <ArrowDown className="mr-2 h-3.5 w-3.5" /> Marcar como mío
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteMsg(m)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Borrar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} womanId={womanId} onSaved={onChange} />

      {/* Corregir sentido */}
      <Dialog open={invertOpen} onOpenChange={setInvertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Corregir sentido de la conversación</DialogTitle>
            <DialogDescription>
              Si la importación confundió quién dijo qué, invierte los emisores. Puede aplicarse a todo el historial o a un rango de mensajes numerados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={invertRangeMode === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setInvertRangeMode("all")}>
                Todo el historial
              </Button>
              <Button variant={invertRangeMode === "range" ? "secondary" : "ghost"} size="sm" onClick={() => setInvertRangeMode("range")}>
                Rango
              </Button>
            </div>
            {invertRangeMode === "range" && (
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="inv-from">Desde el mensaje nº</Label>
                  <Input id="inv-from" type="number" min={1} value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="inv-to">Hasta el nº</Label>
                  <Input id="inv-to" type="number" min={1} value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Acción reversible: puedes volver a invertir.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvertOpen(false)}>Cancelar</Button>
            <Button onClick={invert}>Invertir emisores</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar mensaje */}
      <Dialog open={Boolean(editMsg)} onOpenChange={(v) => !v && setEditMsg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar mensaje</DialogTitle>
            <DialogDescription>Texto y fecha/hora. Sin hora no se puede sugerir cuándo enviar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-body">Texto</Label>
              <Input id="edit-body" value={editBody} onChange={(e) => setEditBody(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-at">Fecha y hora</Label>
              <Input
                id="edit-at"
                type="datetime-local"
                value={editAt}
                onChange={(e) => setEditAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditMsg(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Borrar mensaje */}
      <Dialog open={Boolean(deleteMsg)} onOpenChange={(v) => !v && setDeleteMsg(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Borrar este mensaje?</DialogTitle>
            <DialogDescription>Se quita del historial guardado. La conversación real no se toca.</DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-secondary p-3 text-sm">{deleteMsg?.body}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteMsg(null)}>Conservar</Button>
            <Button variant="destructive" onClick={removeMsg}>Borrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
