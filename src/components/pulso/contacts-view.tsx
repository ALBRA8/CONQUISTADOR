"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api, STATUS_LABEL, type WomanListItem, type WomanStatus } from "@/lib/pulso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusChip, EmptyState, timeAgo, fmtDateTime } from "@/components/pulso/shared";
import { WomanFormDialog } from "@/components/pulso/woman-form";
import { CalendarDays, Search, UserRoundPlus } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ id: "all" | WomanStatus; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "caliente", label: "Calientes" },
  { id: "tibio", label: "Tibias" },
  { id: "frio", label: "Frías" },
  { id: "sinrespuesta", label: "Sin respuesta" },
  { id: "cita", label: "Con cita" },
];

export function ContactsView() {
  const { women, womenLoaded, setWomen, setView } = useAppStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | WomanStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await api<{ women: WomanListItem[] }>("/api/women");
      setWomen(data.women);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos externos
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = [...women];
    if (filter !== "all") list = list.filter((w) => w.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (w) => w.name.toLowerCase().includes(q) || (w.city || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [women, filter, query]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Contactos</h1>
        <Button onClick={() => setFormOpen(true)}>
          <UserRoundPlus className="mr-1.5 h-4 w-4" /> Añadir
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o ciudad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
            aria-label="Buscar contactos"
          />
        </div>
      </div>

      <div className="pulso-scroll flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "whitespace-nowrap rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              filter === f.id && "border-amber-500/50 bg-amber-500/10 text-amber-300"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}{" "}
          <Button variant="outline" size="sm" onClick={load}>
            Reintentar
          </Button>
        </div>
      )}

      {!womenLoaded ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-4">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        women.length === 0 ? (
          <EmptyState
            title="Aún no hay nadie"
            body="Añade a la primera persona: nombre, dónde se conocieron y su conversación. Pulso hará el resto."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <UserRoundPlus className="mr-1.5 h-4 w-4" /> Añade la primera
              </Button>
            }
          />
        ) : (
          <EmptyState title="Sin resultados" body="Nadie coincide con la búsqueda o el filtro activo." />
        )
      ) : (
        <ul className="space-y-3">
          {filtered.map((w) => (
            <li key={w.id}>
              <button
                onClick={() => setView("woman", w.id)}
                className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-amber-500/40"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11 border border-border">
                    {w.photo ? <AvatarImage src={w.photo} alt={`Foto de ${w.name}`} /> : null}
                    <AvatarFallback className="bg-secondary text-sm font-semibold">
                      {w.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {w.name}
                        {w.age ? `, ${w.age}` : ""}
                      </span>
                      <StatusChip status={w.status} />
                      {w.nextDate && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                          <CalendarDays className="h-3 w-3" />
                          {fmtDateTime(w.nextDate.scheduledAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {w.city || "—"}
                      {w.archetype ? ` · ${w.archetype}` : ""}
                    </p>
                    {w.lastMessage ? (
                      <p className="mt-1.5 line-clamp-2 text-sm text-foreground/80">
                        <span className={w.lastMessage.sender === "me" ? "text-amber-400/90" : "text-emerald-400/90"}>
                          {w.lastMessage.sender === "me" ? "Tú: " : "Ella: "}
                        </span>
                        {w.lastMessage.body}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm text-muted-foreground">Sin conversación aún</p>
                    )}
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{timeAgo(w.lastMessage?.at || null)}</span>
                      <span>Interés estimado: {w.interestLevel}/100</span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <WomanFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={load} />
    </div>
  );
}
