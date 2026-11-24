"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type Woman } from "@/lib/pulso";

const CHANNELS = [
  { id: "dia", label: "Conocida de día" },
  { id: "noche", label: "Conocida de noche" },
  { id: "app", label: "App de citas" },
  { id: "otro", label: "Otro" },
];

export function WomanFormDialog({
  open,
  onOpenChange,
  onSaved,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editing?: Woman | null;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    age: "",
    city: "",
    occupation: "",
    metWhere: "",
    channel: "dia",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: editing?.name || "",
        age: editing?.age ? String(editing.age) : "",
        city: editing?.city || "",
        occupation: editing?.occupation || "",
        metWhere: editing?.metWhere || "",
        channel: editing?.channel || "dia",
        phone: editing?.phone || "",
        notes: editing?.notes || "",
      });
    }
  }, [open, editing]);

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Falta el nombre", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        age: form.age ? Number(form.age) : null,
        city: form.city.trim() || null,
        occupation: form.occupation.trim() || null,
        metWhere: form.metWhere.trim() || null,
        channel: form.channel,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await api(`/api/women/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast({ title: "Ficha actualizada" });
      } else {
        await api("/api/women", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Ficha creada" });
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pulso-scroll max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar ficha" : "Nueva ficha"}</DialogTitle>
          <DialogDescription>
            Los datos de aquí alimentan al coach: cuanto más contexto, mejores lecturas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="w-name">Nombre *</Label>
            <Input id="w-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-age">Edad</Label>
            <Input id="w-age" type="number" min={18} max={99} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-city">Ciudad</Label>
            <Input id="w-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-occ">Ocupación</Label>
            <Input id="w-occ" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="w-met">Dónde se conocieron</Label>
            <Input id="w-met" placeholder="Ej: por amigos, en la universidad, en un bar…" value={form.metWhere} onChange={(e) => setForm({ ...form, metWhere: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Canal del primer contacto</Label>
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-phone">Teléfono (para enlace wa.me)</Label>
            <Input id="w-phone" type="tel" inputMode="tel" placeholder="+57…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="w-notes">Notas</Label>
            <Textarea id="w-notes" rows={3} placeholder="Gustos, temas que le mueven, contexto útil…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
