// Parseador local de .txt exportado de WhatsApp (sección 8.6: puede ser código
// local, no IA). Solo se manda a la IA lo que no se pueda interpretar.

export type ParsedLine = {
  sender: string; // autor según el archivo
  body: string;
  sentAt: string | null; // ISO o null
};

const MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
  jan: 0, apr: 3, aug: 7, dec: 11,
};

function twoDigitYear(y: number): number {
  return y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
}

// Intenta parsear una fecha de cabecera de WhatsApp
function parseHeaderDate(datePart: string): Date | null {
  // Formatos: DD/MM/YYYY, HH:MM | DD/MM/YY, HH:MM | D MMM, YYYY HH:MM | YYYY-MM-DD, HH:MM
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(datePart);
  if (iso) {
    return new Date(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5], iso[6] ? +iso[6] : 0);
  }
  const dmy = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})[,]?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm|AM|PM))?/.exec(datePart);
  if (dmy) {
    let h = +dmy[4];
    const ap = dmy[7]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const y = twoDigitYear(+dmy[3]);
    return new Date(y, +dmy[2] - 1, +dmy[1], h, +dmy[5], dmy[6] ? +dmy[6] : 0);
  }
  const textual = /^(\d{1,2})\s+([a-zA-Záéíóú]{3,4})\.?,?\s+(\d{4})[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(datePart);
  if (textual) {
    const mon = MONTHS[textual[2].toLowerCase().slice(0, 3)];
    if (mon !== undefined) {
      return new Date(+textual[3], mon, +textual[1], +textual[4], +textual[5], textual[6] ? +textual[6] : 0);
    }
  }
  return null;
}

export type TxtParseResult = {
  ok: boolean;
  messages: ParsedLine[];
  authors: string[]; // autores distintos detectados
  unparsedLines: number;
  totalLines: number;
};

export function parseWhatsAppTxt(text: string): TxtParseResult {
  const lines = text.replace(/\r/g, "").split("\n");
  const messages: ParsedLine[] = [];
  let unparsed = 0;

  // Cabecera con corchetes: [12/03/24, 21:34:02] Autor: mensaje
  // Cabecera clásica:      12/03/2024, 21:34 - Autor: mensaje
  const bracketRe = /^\[(.+?)\]\s*([^:]{1,64}?):\s*([\s\S]*)$/;
  const classicRe = /^(.+?)\s+-\s+([^:]{1,64}?):\s*([\s\S]*)$/;

  let current: ParsedLine | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    let matched = false;

    const header =
      bracketRe.exec(line) ||
      (() => {
        // Para el clásico, la parte de fecha debe contener dígitos de fecha
        const m = classicRe.exec(line);
        if (!m) return null;
        const d = parseHeaderDate(m[1]);
        return d ? { 1: m[1], 2: m[2], 3: m[3] } : null;
      })();

    if (header) {
      let datePart: string;
      let sender: string;
      let body: string;
      if (bracketRe.test(line) && (header as RegExpExecArray)[1] !== undefined) {
        const h = header as RegExpExecArray;
        datePart = h[1];
        sender = h[2].trim();
        body = h[3] ?? "";
      } else {
        const h = header as unknown as { 1: string; 2: string; 3: string };
        datePart = h[1];
        sender = h[2].trim();
        body = h[3];
      }
      const date = parseHeaderDate(datePart);
      current = { sender, body: body.trim(), sentAt: date ? date.toISOString() : null };
      messages.push(current);
      matched = true;
    }

    if (!matched) {
      // Línea de sistema ("Los mensajes y las llamadas están cifrados…") → ignorar
      if (/los mensajes y las llamadas est|messages and calls are end|cifrado de extremo/i.test(line)) {
        current = current;
        continue;
      }
      if (current && messages.length > 0) {
        current.body += "\n" + line;
      } else {
        unparsed++;
      }
    }
  }

  const authors = [...new Set(messages.map((m) => m.sender))];
  return {
    ok: messages.length > 0 && unparsed <= messages.length * 0.5,
    messages,
    authors,
    unparsedLines: unparsed,
    totalLines: lines.length,
  };
}
