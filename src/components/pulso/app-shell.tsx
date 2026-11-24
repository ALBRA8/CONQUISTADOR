"use client";

import { useCallback, useEffect } from "react";
import { useAppStore, type ViewId } from "@/store/useAppStore";
import { api } from "@/lib/pulso";
import { MeasuredBadge, PulseLogo } from "@/components/pulso/shared";
import { ContactsView } from "@/components/pulso/contacts-view";
import { WomanDetail } from "@/components/pulso/woman-detail";
import { CoachView } from "@/components/pulso/coach-view";
import { TodayView } from "@/components/pulso/today-view";
import { DatesView } from "@/components/pulso/dates-view";
import { ToolsView } from "@/components/pulso/tools-view";
import { MedalsView } from "@/components/pulso/medals-view";
import { SettingsView } from "@/components/pulso/settings-view";
import { cn } from "@/lib/utils";
import {
  Heart,
  MessageSquare,
  CalendarDays,
  Sun,
  Wrench,
  Medal,
  Settings,
} from "lucide-react";

const NAV: Array<{ id: ViewId; label: string; icon: React.ReactNode }> = [
  { id: "contacts", label: "Contactos", icon: <Heart className="h-4 w-4" /> },
  { id: "coach", label: "Coach", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "today", label: "Hoy", icon: <Sun className="h-4 w-4" /> },
  { id: "dates", label: "Citas", icon: <CalendarDays className="h-4 w-4" /> },
  { id: "tools", label: "Herramientas", icon: <Wrench className="h-4 w-4" /> },
  { id: "medals", label: "Medallas", icon: <Medal className="h-4 w-4" /> },
  { id: "settings", label: "Ajustes", icon: <Settings className="h-4 w-4" /> },
];

export function AppShell() {
  const { view, setView, selectedWomanId, me, refreshQuota } = useAppStore();

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ quota: { used: number } }>("/api/me");
      refreshQuota(data.quota.used);
    } catch {
      // silencioso: solo actualiza el contador de cuota
    }
  }, [refreshQuota]);

  useEffect(() => {
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <button className="flex items-center" onClick={() => setView("contacts")} aria-label="Ir a contactos">
            <PulseLogo />
          </button>
          {me && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">
                Coach: {me.quota.used}/{me.quota.limit} consultas hoy
              </span>
              <span className="sm:hidden">
                {me.quota.used}/{me.quota.limit}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-0 px-0 md:px-4">
        <nav
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 flex-col gap-1 border-r border-border p-3 md:flex"
          aria-label="Navegación principal"
        >
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                view === n.id && "bg-accent text-foreground"
              )}
              aria-current={view === n.id ? "page" : undefined}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
          <div className="mt-auto px-3 pb-1">
            <MeasuredBadge />
            <p className="mt-2 text-[10px] leading-tight text-muted-foreground">
              Herramienta de apoyo. Sin conexión a mensajería. Si ella dice no, se para.
            </p>
          </div>
        </nav>

        <main className="min-w-0 flex-1 pb-20 md:pb-8">
          {view === "contacts" && <ContactsView />}
          {view === "woman" && selectedWomanId && <WomanDetail id={selectedWomanId} />}
          {view === "coach" && <CoachView />}
          {view === "today" && <TodayView />}
          {view === "dates" && <DatesView />}
          {view === "tools" && <ToolsView />}
          {view === "medals" && <MedalsView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Navegación móvil */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        aria-label="Navegación principal"
      >
        <div className="pulso-scroll flex items-stretch gap-1 overflow-x-auto px-2 py-1.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={cn(
                "flex min-w-[64px] flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-medium text-muted-foreground",
                view === n.id && "bg-accent text-foreground"
              )}
              aria-current={view === n.id ? "page" : undefined}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      <footer className="mt-auto hidden border-t border-border py-3 text-center text-[11px] text-muted-foreground md:block">
        Pulso — herramienta de apoyo, no garantiza resultados · sin conexión a WhatsApp ni redes ·
        si la otra persona no está cómoda, se para
      </footer>
    </div>
  );
}
