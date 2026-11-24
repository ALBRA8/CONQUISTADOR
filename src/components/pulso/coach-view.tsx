"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api, type WomanListItem, type Woman } from "@/lib/pulso";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/pulso/shared";
import { CoachThreadPanel } from "@/components/pulso/coach-thread";
import { MessageSquare, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WomanFormDialog } from "@/components/pulso/woman-form";

// Coach global: elige a quién le hablas y abre el chat del núcleo
export function CoachView() {
  const { women, womenLoaded, selectedWomanId, setSelectedWoman, setView } = useAppStore();
  const [detail, setDetail] = useState<{ woman: Woman; messages: Array<{ sender: string; sentAt: string | null }>; thread: { id: string; protocol: string; step: number } | null } | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const selected = women.find((w) => w.id === selectedWomanId) || women[0] || null;

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!selected) {
        if (alive) setDetail(null);
        return;
      }
      try {
        const d = await api<{ woman: Woman; messages: Array<{ sender: string; sentAt: string | null }>; thread: { id: string; protocol: string; step: number } | null }>(
          `/api/women/${selected.id}`
        );
        if (alive) setDetail(d);
      } catch {
        if (alive) setDetail(null);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [selected?.id, womenLoaded]);

  if (womenLoaded && women.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="El coach necesita una ficha"
          body="Crea la ficha de una persona, añade su conversación y aquí podrás preguntarle al coach qué hacer."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <UserRoundPlus className="mr-1.5 h-4 w-4" /> Añadir persona
            </Button>
          }
        />
        <WomanFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={() => setView("contacts")} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <MessageSquare className="h-5 w-5 text-amber-400" /> Coach
        </h1>
        <div className="w-56">
          <Select
            value={selected?.id || ""}
            onValueChange={(v) => setSelectedWoman(v)}
          >
            <SelectTrigger aria-label="Elegir persona">
              <SelectValue placeholder="Elige una persona" />
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
      </div>
      {detail ? (
        <CoachThreadPanel
          woman={detail.woman}
          thread={detail.thread}
          messages={detail.messages}
          onActivity={() => undefined}
        />
      ) : (
        <p className="p-6 text-center text-sm text-muted-foreground">Cargando conversación…</p>
      )}
    </div>
  );
}
