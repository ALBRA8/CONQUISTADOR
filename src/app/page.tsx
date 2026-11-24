"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { api, type Me, type WomanListItem } from "@/lib/pulso";
import { AuthView } from "@/components/pulso/auth-view";
import { OnboardingView } from "@/components/pulso/onboarding-view";
import { AppShell } from "@/components/pulso/app-shell";
import { PulseLogo } from "@/components/pulso/shared";

export default function PulsoPage() {
  const { booted, me, setMe, setBooted, setWomen, setWomenLoaded } = useAppStore();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const bootstrap = useCallback(async () => {
    try {
      const data = await api<Me>("/api/me");
      setMe(data);
      setNeedsOnboarding(!data.user.onboardingDone);
    } catch {
      setMe(null);
    } finally {
      setBooted(true);
    }
  }, [setBooted, setMe]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const refreshWomen = useCallback(async () => {
    try {
      const data = await api<{ women: WomanListItem[] }>("/api/women");
      setWomen(data.women);
    } catch {
      setWomenLoaded(true);
    }
  }, [setWomen, setWomenLoaded]);

  useEffect(() => {
    if (me) refreshWomen();
  }, [me?.user.id, refreshWomen]);

  if (!booted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <PulseLogo size={40} />
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <AuthView
        onDone={(needs) => {
          setNeedsOnboarding(needs);
          bootstrap();
        }}
      />
    );
  }

  if (needsOnboarding) {
    return (
      <OnboardingView
        onFinish={() => {
          setNeedsOnboarding(false);
          bootstrap();
        }}
      />
    );
  }

  return <AppShell />;
}
