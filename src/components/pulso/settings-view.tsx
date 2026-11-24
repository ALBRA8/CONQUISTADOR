"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/pulso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MeasuredBadge } from "@/components/pulso/shared";
import { Download, LogOut, ShieldAlert, Trash2 } from "lucide-react";

const TONES = ["misterioso", "coqueto", "casual", "suave", "atrevido", "divertido", "romantico", "directo"];

// Ajustes (sección 6.12): idioma, tono, longitud, exportar y borrar de verdad
export function SettingsView() {
  const { me, setMe, reset, setWomenLoaded } = useAppStore();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  async function save(patch: Record<string, unknown>) {
    try {
      const res = await api<{ user: { locale: string; toneDefault: string; lengthPref: string; onboardingDone: boolean } }>(
        "/api/settings",
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      if (me) {
        setMe({ ...me, user: { ...me.user, ...res.user } });
      }
      toast({ title: "Ajustes guardados" });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    reset();
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api("/api/account", { method: "DELETE", body: JSON.stringify({ confirm: confirmText.trim() }) });
      toast({ title: "Cuenta borrada", description: "Tus datos se eliminaron de la base de datos." });
      reset();
      router.refresh();
    } catch (e) {
      toast({ title: "No se pudo borrar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>

      {me && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Cuenta</h2>
          <p className="mt-1 text-sm text-muted-foreground">{me.user.email}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={logout}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Salir
          </Button>
        </section>
      )}

      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Preferencias del coach</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Idioma</Label>
            <Select value={me?.user.locale || "es"} onValueChange={(v) => save({ locale: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en" disabled>
                  English (v2)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tono por defecto</Label>
            <Select value={me?.user.toneDefault || "casual"} onValueChange={(v) => save({ toneDefault: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Longitud preferida</Label>
            <Select value={me?.user.lengthPref || "corta"} onValueChange={(v) => save({ lengthPref: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corta">Corta (una línea)</SelectItem>
                <SelectItem value="estandar">Estándar (dos líneas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {me && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            Tus números <MeasuredBadge />
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Mensajes enviados" value={me.stats.mensajesEnviados} />
            <Stat label="Tasa de respuesta" value={`${me.stats.tasaRespuesta}%`} />
            <Stat
              label="Respuesta media de ella"
              value={me.stats.tiempoMedioRespuestaElla !== null ? `${me.stats.tiempoMedioRespuestaElla} min` : "—"}
            />
            <Stat label="Citas propuestas" value={me.stats.citasPropuestas} />
            <Stat label="Citas hechas" value={me.stats.citasHechas} />
            <Stat label="Días activo" value={me.stats.diasActivo} />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Estos son los únicos números medidos que muestra Pulso, calculados sobre tu cuenta. No existen estadísticas de mercado.
          </p>
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Tus datos</h2>
        <p className="text-sm text-muted-foreground">
          Qué se guarda: tu correo, tus fichas, las copias de conversaciones que subas, los análisis del coach y su registro de depuración. Se envía al proveedor de IA solo lo necesario para responder. La conexión viaja cifrada y nada se usa para entrenar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export?format=json" download>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar JSON
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export?format=csv" download>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDataOpen(true)}>
            Ver explicación completa
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-destructive">
          <ShieldAlert className="h-4 w-4" /> Zona peligrosa
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Borrar la cuenta elimina de verdad: fichas, conversaciones, análisis, citas, medallas y registros. No hay vuelta atrás.
        </p>
        <Button variant="destructive" size="sm" className="mt-3" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Borrar mi cuenta
        </Button>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Borrar cuenta y todos los datos</DialogTitle>
            <DialogDescription>
              Confirmación escrita obligatoria: escribe <strong>BORRAR</strong> para ejecutar el borrado definitivo.
            </DialogDescription>
          </DialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="BORRAR" aria-label="Confirmación de borrado" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={busy || confirmText.trim().toUpperCase() !== "BORRAR"}>
              {busy ? "Borrando…" : "Borrar todo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dataOpen} onOpenChange={setDataOpen}>
        <DialogContent className="pulso-scroll max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Qué se guarda y qué se manda a la IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">En tu base de datos</strong> (con acceso restringido a tu cuenta): correo, preferencias, fichas con foto opcional, copias de conversaciones que importes, análisis guardados, hilos del coach con el registro del prompt enviado (para depurar), citas, medallas y el registro de auditoría de tus acciones.
            </p>
            <p>
              <strong className="text-foreground">Al proveedor de IA</strong> viaja solo lo que hace falta para responder: la ficha relevante, los últimos mensajes de esa conversación y tu pregunta. Las capturas se envían solo cuando pides leerlas. Nada se usa para entrenar modelos.
            </p>
            <p>
              <strong className="text-foreground">Cifrado</strong> en tránsito (HTTPS) y en reposo a nivel de base de datos. La clave del proveedor de IA vive únicamente en el servidor.
            </p>
            <p>
              <strong className="text-foreground">Exportación:</strong> JSON completo y CSV legible (fichas, mensajes, citas y métricas). <strong className="text-foreground">Borrado:</strong> elimina la cuenta y todos los registros con cascada real, y deja solo una nota anónima de que hubo un borrado.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-secondary p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}
