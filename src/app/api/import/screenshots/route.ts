import { NextRequest, NextResponse } from "next/server";
import { requireUser, checkQuota, consumeQuota, jsonError } from "@/lib/apiHelpers";
import { aiComplete, AiUnavailableError } from "@/lib/ai/provider";
import { extractJson } from "@/lib/ai/blocks";

// Camino A: extracción de conversación desde capturas de pantalla (sección 6.6.A).
// La IA lee la imagen y devuelve {emisor, texto, hora, confianza}; el usuario
// confirma y corrige ANTES de guardar. Las burbujas de WhatsApp: derecha = el
// usuario (YO), izquierda = ella.

const EXTRACT_SYSTEM = `Eres un extractor de texto de capturas de WhatsApp. Devuelves SOLO un JSON válido:
{"mensajes":[{"emisor":"yo"|"ella","texto":"...","hora":"HH:MM" o null,"confianza":0.0-1.0}]}
Reglas:
- Burbujas alineadas a la DERECHA = "yo" (el dueño del teléfono). Burbujas a la IZQUIERDA = "ella".
- Transcribe el texto exacto de cada burbuja, sin corregirlo ni inventar nada.
- "hora" es la que aparece junto a la burbuja; si no se lee, null.
- "confianza" refleja qué tan legible estaba la burbuja (menor de 0.6 si dudosa).
- Si una captura continúa la anterior, sigue la secuencia sin repetir.
- Ignora encabezados del sistema, teclado o barras.
- Máximo 60 burbujas por respuesta.`;

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;

  const quota = await checkQuota(auth.user);
  if (!quota.ok) return quota.res;

  const body = (await req.json().catch(() => null)) as { images?: string[] } | null;
  const images = (body?.images || []).filter((i) => typeof i === "string" && i.startsWith("data:image/"));
  if (images.length === 0) {
    return NextResponse.json({ error: "Sube al menos una captura de pantalla." }, { status: 400 });
  }
  if (images.length > 5) {
    return NextResponse.json({ error: "Máximo 5 capturas por lote." }, { status: 400 });
  }

  try {
    const result = await aiComplete({
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        {
          role: "user",
          content: `Estas ${images.length} captura(s) de WhatsApp están en orden de lectura. Extrae la lista de mensajes. Responde SOLO el JSON.`,
        },
      ],
      images,
      quality: "fast",
      temperature: 0.1,
    });
    await consumeQuota(auth.user.id);

    const parsed = extractJson<{ mensajes?: Array<{ emisor?: string; texto?: string; hora?: string | null; confianza?: number }> }>(
      result.text
    );
    // Reintento una vez si el JSON falló (sección 4.3)
    if (!parsed?.mensajes) {
      const retry = await aiComplete({
        messages: [
          { role: "system", content: EXTRACT_SYSTEM },
          {
            role: "user",
            content: `Estas ${images.length} capturas están en orden de lectura. Extrae la lista de mensajes.\n\nATENCIÓN: tu respuesta anterior no fue JSON válido. Devuelve SOLO el objeto JSON con la clave "mensajes".`,
          },
        ],
        images,
        quality: "fast",
        temperature: 0.1,
      });
      const retryParsed = extractJson<{ mensajes?: Array<{ emisor?: string; texto?: string; hora?: string | null; confianza?: number }> }>(
        retry.text
      );
      if (!retryParsed?.mensajes) {
        return jsonError("La lectura de las capturas no salió bien. Intenta de nuevo o usa el archivo .txt, que es más fiable.", 502, "bad_json");
      }
      return NextResponse.json({ ok: true, messages: normalize(retryParsed.mensajes), model: result.model });
    }

    return NextResponse.json({ ok: true, messages: normalize(parsed.mensajes), model: result.model });
  } catch (e) {
    if (e instanceof AiUnavailableError) {
      return jsonError("El servicio de lectura de imágenes no responde ahora mismo. Prueba en unos minutos o usa el archivo .txt.", 503, "ai_unavailable");
    }
    return jsonError("No se pudo leer la captura. Revisa que la imagen sea válida.", 500, "unknown");
  }
}

function normalize(
  list: Array<{ emisor?: string; texto?: string; hora?: string | null; confianza?: number }>
) {
  return list
    .filter((m) => typeof m.texto === "string" && m.texto.trim())
    .map((m) => ({
      sender: m.emisor === "yo" || m.emisor === "me" ? "me" : "her",
      body: (m.texto || "").trim().slice(0, 2000),
      hora: typeof m.hora === "string" ? m.hora : null,
      confidence: typeof m.confianza === "number" ? Math.min(Math.max(m.confianza, 0), 1) : 0.5,
    }));
}
