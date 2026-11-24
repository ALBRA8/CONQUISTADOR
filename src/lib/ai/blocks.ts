// Parser de bloques de salida del coach (etiquetas fijas definidas por nosotros)
// y utilidades JSON estrictas (sección 4.3: esquema validado, reintento, degradación).

export type CoachBlocks = {
  lectura?: string;
  accion?: string;
  mensaje?: string;
  hora?: string;
  si?: string;
  alto?: boolean;
  motivoAlto?: string;
  raw: string;
};

const TAGS = ["LECTURA", "ACCION", "MENSAJE", "HORA", "SI", "ALTO"] as const;

// [FASE n] es un marcador interno de progreso del protocolo: se consume en el
// servidor y NUNCA se muestra en la interfaz (sección 6.7).
function stripInternalTags(text: string): string {
  return text.replace(/\[FASE\s*\d+\]/gi, "").trim();
}

export function parseCoachBlocks(text: string): CoachBlocks {
  const raw = stripInternalTags(text.trim());
  // Detectar tarjeta de parada ([ALTO] o texto de moderación)
  const altoMatch = /\[ALTO\]\s*([\s\S]*?)(?=\[(?:LECTURA|ACCION|MENSAJE|HORA|SI)\]|$)/i.exec(raw);

  const out: CoachBlocks = { raw };
  const re = /\[(LECTURA|ACCION|MENSAJE|HORA|SI)\]\s*([\s\S]*?)(?=\[(?:LECTURA|ACCION|MENSAJE|HORA|SI|ALTO)\]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const tag = m[1].toUpperCase() as (typeof TAGS)[number];
    const value = m[2].trim();
    if (tag === "LECTURA") out.lectura = value;
    else if (tag === "ACCION") out.accion = value;
    else if (tag === "MENSAJE") out.mensaje = value;
    else if (tag === "HORA") out.hora = value;
    else if (tag === "SI") out.si = value;
  }
  if (altoMatch) {
    out.alto = true;
    out.motivoAlto = altoMatch[1].trim();
  }
  return out;
}

export function blocksAreComplete(b: CoachBlocks): boolean {
  return Boolean(b.lectura && b.accion && b.mensaje && b.hora && b.si);
}

// Extrae el primer objeto JSON de un texto (tolera ```json fences)
export function extractJson<T>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  // Buscar el cierre balanceado
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Validación de longitud de mensajes sugeridos (sección 15.3):
// se pide la longitud en la salida y se valida en servidor.
export function validateMessageLength(text: string, opts: { isFirst?: boolean; herLastLength?: number }): {
  ok: boolean;
  reason?: string;
} {
  const len = [...text.trim()].length;
  if (/\[MENSAJE\]/.test(text)) return { ok: true };
  if (opts.isFirst) {
    if (len < 20 || len > 60) return { ok: false, reason: `Un primer mensaje tras conseguir el contacto debe ir entre 30 y 40 caracteres; este tiene ${len}.` };
    return { ok: true };
  }
  if (opts.herLastLength !== undefined && opts.herLastLength <= 12) {
    if (len > 40) return { ok: false, reason: `Su último mensaje fue muy corto: techo de 40 caracteres y este tiene ${len}.` };
    return { ok: true };
  }
  if (len > 220) return { ok: false, reason: `El mensaje tiene ${len} caracteres; el máximo razonable son dos líneas (~180).` };
  return { ok: true };
}
