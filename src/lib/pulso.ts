// Tipos compartidos del frontend de Pulso
export type WomanStatus = "frio" | "tibio" | "caliente" | "sinrespuesta" | "cita";

export type WomanListItem = {
  id: string;
  name: string;
  age: number | null;
  city: string | null;
  occupation: string | null;
  photo: string | null;
  archetype: string | null;
  status: WomanStatus;
  stage: string;
  interestLevel: number;
  phone: string | null;
  lastMessage: { sender: string; body: string; at: string | null } | null;
  nextDate: { id: string; scheduledAt: string; place: string | null } | null;
  createdAt: string;
};

export type Woman = {
  id: string;
  userId: string;
  name: string;
  age: number | null;
  city: string | null;
  occupation: string | null;
  photo: string | null;
  metWhere: string | null;
  archetype: string | null;
  interestLevel: number;
  stage: string;
  phone: string | null;
  channel: string | null;
  status: WomanStatus;
  notes: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type Message = {
  id: string;
  womanId: string;
  sender: "me" | "her";
  body: string;
  sentAt: string | null;
  source: string;
  confidence: number | null;
  createdAt: string;
};

export type CoachBlocks = {
  lectura?: string;
  accion?: string;
  mensaje?: string;
  hora?: string;
  si?: string;
  alto?: boolean;
  motivoAlto?: string;
  raw?: string;
};

export type CoachTurnView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: CoachBlocks | null;
  createdAt: string;
};

export type AnalysisRow = {
  id: string;
  womanId: string;
  kind: string;
  metrics: string | null;
  summary: string | null;
  model: string | null;
  createdAt: string;
};

export type DateEntry = {
  id: string;
  womanId: string;
  scheduledAt: string;
  place: string | null;
  status: "agendada" | "hecha" | "cancelada" | "no_show";
  preBriefing: string | null;
  debriefing: string | null;
  createdAt: string;
  woman?: { name: string; photo: string | null };
};

export type Me = {
  user: {
    id: string;
    email: string;
    locale: string;
    onboardingDone: boolean;
    toneDefault: string;
    lengthPref: string;
  };
  quota: { used: number; limit: number; resetAt: string | null };
  stats: {
    mensajesEnviados: number;
    mensajesRecibidos: number;
    tasaRespuesta: number;
    tiempoMedioRespuestaElla: number | null;
    diasActivo: number;
    citasPropuestas: number;
    citasHechas: number;
  };
  provider: string;
};

export const STATUS_LABEL: Record<WomanStatus, string> = {
  frio: "Frío",
  tibio: "Tibio",
  caliente: "Caliente",
  sinrespuesta: "Sin respuesta",
  cita: "Cita agendada",
};

export const STATUS_CLASS: Record<WomanStatus, string> = {
  frio: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  tibio: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  caliente: "bg-red-500/15 text-red-300 border-red-500/30",
  sinrespuesta: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30",
  cita: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || "Error de conexión.") as Error & { code?: string; status?: number };
    err.code = (data as { code?: string }).code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}
