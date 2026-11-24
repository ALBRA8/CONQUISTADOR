"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/pulso";
import { PulseLogo } from "@/components/pulso/shared";
import { ArrowRight, Camera, ShieldCheck, Unplug } from "lucide-react";

// Onboarding de 3 pasos, salteable (sección 6.2)
export function OnboardingView({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);

  async function finish() {
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ onboardingDone: true }),
      });
    } catch {
      // el onboarding no debe bloquear la entrada
    }
    onFinish();
  }

  const steps = [
    {
      icon: <Unplug className="h-8 w-8 text-amber-400" />,
      title: "Pulso no se conecta a tu WhatsApp",
      body: "Ni a Instagram ni a nada. Tú copias y pegas: subes una captura, importas el archivo o escribes los mensajes a mano. La app guarda una copia en tu cuenta para poder leerla y aconsejarte. Nada se envía desde Pulso.",
    },
    {
      icon: <Camera className="h-8 w-8 text-amber-400" />,
      title: "Cómo funciona",
      body: "Creas una ficha por persona. Subes la conversación. La IA la ordena, lee el último mensaje y te devuelve tres cosas: qué está pasando, qué hacer y el mensaje exacto con la hora sugerida para enviarlo.",
    },
    {
      icon: <ShieldCheck className="h-8 w-8 text-amber-400" />,
      title: "Las reglas",
      body: "Solo mayores de edad. Esto es una herramienta de apoyo, no garantiza nada. Si la otra persona dice no, pide espacio o se incomoda, el coach se para y te lo dice. Sin acosar, sin presionar, sin manipular.",
    },
  ];

  const s = steps[step];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <PulseLogo size={36} />
        </div>
        <div className="space-y-6 rounded-lg border border-border bg-card p-8 text-center">
          <div className="flex justify-center">{s.icon}</div>
          <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          <div className="flex items-center justify-center gap-1.5" aria-label={`Paso ${step + 1} de 3`}>
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-6 rounded-full ${i === step ? "bg-amber-500" : "bg-secondary"}`}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={finish}>
            Saltar
          </Button>
          {step < 2 ? (
            <Button className="flex-1" onClick={() => setStep(step + 1)}>
              Siguiente <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button className="flex-1" onClick={finish}>
              Empezar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
