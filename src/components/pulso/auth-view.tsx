"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { PulseLogo } from "@/components/pulso/shared";
import { api } from "@/lib/pulso";
import { ScrollText, ShieldCheck } from "lucide-react";

// Pantalla de entrada (sección 6.1): correo + código de un solo uso (demo),
// casilla de edad y consentimiento explícito con las reglas de la sección 2.3.

export function AuthView({ onDone }: { onDone: (needsOnboarding: boolean) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [ageOk, setAgeOk] = useState(false);
  const [consentOk, setConsentOk] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setError(null);
    if (!email.trim()) return setError("Escribe tu correo.");
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; demoCode: string }>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email, ageOk, consentOk }),
      });
      setDemoCode(res.demoCode);
      setStep("code");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    if (code.length !== 6) return setError("El código tiene 6 dígitos.");
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; isNew: boolean; needsOnboarding: boolean }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      toast({ title: res.isNew ? "Cuenta creada" : "Bienvenido de vuelta", description: email });
      onDone(res.needsOnboarding);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <PulseLogo size={40} />
          <h1 className="text-2xl font-semibold tracking-tight">
            Conversa mejor. Con reglas.
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Pulso guarda una copia de tus conversaciones, las lee y te dice qué
            hacer y qué escribir. Tú mandas siempre desde tu propia mensajería.
          </p>
        </div>

        {step === "email" ? (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-2 text-sm leading-snug">
                <Checkbox checked={ageOk} onCheckedChange={(v) => setAgeOk(v === true)} id="age" className="mt-0.5" />
                <span htmlFor="age">Soy mayor de edad (18+).</span>
              </label>
              <label className="flex items-start gap-2 text-sm leading-snug">
                <Checkbox checked={consentOk} onCheckedChange={(v) => setConsentOk(v === true)} id="consent" className="mt-0.5" />
                <span htmlFor="consent">
                  Entiendo que Pulso es una <strong>herramienta de apoyo</strong>: no garantiza resultados,
                  no da permiso para acosar ni presionar, y si la otra persona no está cómoda o dice que no,{" "}
                  <strong>se para</strong>.{" "}
                  <ReglasDialog />
                </span>
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={requestCode} disabled={busy}>
              {busy ? "Enviando…" : "Recibir código"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Sin contraseña. Un código de un solo uso cada vez.
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            {demoCode && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-amber-300">
                  <ShieldCheck className="h-4 w-4" /> Modo demo
                </p>
                <p className="mt-1 text-muted-foreground">
                  Este entorno no envía correos reales. Tu código es{" "}
                  <span className="font-mono font-bold text-foreground">{demoCode}</span>.
                </p>
              </div>
            )}
            <div className="flex flex-col items-center gap-3">
              <Label>Tu código</Label>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSeparator />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={verify} disabled={busy || code.length !== 6}>
              {busy ? "Entrando…" : "Entrar"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep("email")}>
              Volver
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReglasDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex items-center gap-1 font-medium text-amber-400 underline underline-offset-2"
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          <ScrollText className="h-3.5 w-3.5" />
          Leer las reglas completas
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto pulso-scroll sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Límites y reglas de Pulso</DialogTitle>
          <DialogDescription>Lenguaje llano. Lo que esta herramienta sí hace y lo que jamás hace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <div>
            <p className="font-medium text-foreground">Qué es Pulso</p>
            <p className="mt-1 text-muted-foreground">
              Un cuaderno de conversaciones con un coach encima. Tú registras a cada persona que te
              interesa, pegas o subes la conversación (captura, archivo o a mano), y recibes una
              lectura de la situación y propuestas de mensaje. Tú escribes siempre desde tu propia
              mensajería: Pulso no se conecta a WhatsApp ni a ninguna red, no escribe por ti y no lee
              tu teléfono.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Qué no es</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>No es una garantía de resultados: los análisis son estimaciones sobre texto.</li>
              <li>No es un robot que escriba por ti ni que Contacte a nadie.</li>
              <li>No es un espacio para manipular, acosar ni presionar a nadie.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Las reglas duras</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Si la otra persona dice que no, pide espacio o muestra incomodidad, el coach se detiene y te lo dice.</li>
              <li>El asistente se niega a escribir mensajes coercitivos, amenazantes o que ignoren un consentimiento.</li>
              <li>No se valida insistencia tras un rechazo ni contacto con quien pidió distancia.</li>
              <li>No se generaliza sobre las mujeres: se habla de esta persona y esta conversación.</li>
              <li>Solo mayores de edad.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Tus datos</p>
            <p className="mt-1 text-muted-foreground">
              Tus fichas y conversaciones se guardan en tu cuenta y se envían al proveedor de IA solo
              para analizarlas. Puedes exportar todo (JSON y CSV) y borrar tu cuenta con todos sus
              datos en cualquier momento desde Ajustes.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
