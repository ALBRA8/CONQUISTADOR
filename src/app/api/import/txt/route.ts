import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/apiHelpers";
import { parseWhatsAppTxt } from "@/lib/import/whatsappTxt";

// Camino B: parseo LOCAL del .txt exportado de WhatsApp.
// Nunca se manda el archivo a la IA si se puede interpretar aquí.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text || "";
  if (!text.trim()) {
    return NextResponse.json({ error: "Pega o sube el contenido del archivo .txt." }, { status: 400 });
  }
  if (text.length > 500_000) {
    return NextResponse.json({ error: "El archivo es demasiado grande. Divídelo en partes." }, { status: 413 });
  }

  const result = parseWhatsAppTxt(text);
  if (result.messages.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "No se reconoció el formato. Asegúrate de que es el archivo exportado de WhatsApp (con notificaciones activadas).",
    }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    authors: result.authors,
    unparsedLines: result.unparsedLines,
    needsAiAssist: result.unparsedLines > result.messages.length * 0.2,
    messages: result.messages,
  });
}
