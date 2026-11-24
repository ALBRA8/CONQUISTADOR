// Adaptador de IA intercambiable por variable de entorno (sección 4.2).
// AI_PROVIDER=zai (por defecto, SDK del entorno) | openai (cualquier endpoint OpenAI-compatible)
// La clave vive SOLO en el servidor; nunca se expone al navegador.

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRequest = {
  messages: AIMessage[];
  images?: string[]; // data URLs (base64) para extracción desde capturas
  quality?: "fast" | "best"; // modelo rápido y barato por defecto; mejor modelo para análisis profundo
  temperature?: number;
  maxTokens?: number;
};

export type AIResult = {
  text: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
};

export function aiProviderName(): string {
  return process.env.AI_PROVIDER || "zai";
}

function openaiModel(req: AIRequest): string {
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;
  return req.quality === "best" ? "gpt-4o" : "gpt-4o-mini";
}

async function callZai(req: AIRequest): Promise<AIResult> {
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  const zai = await ZAI.create();

  if (req.images && req.images.length > 0) {
    const content: Array<Record<string, unknown>> = [];
    for (const m of req.messages) {
      content.push({ type: "text", text: m.content });
    }
    for (const img of req.images) {
      content.push({ type: "image_url", image_url: { url: img } });
    }
    const res = await zai.chat.completions.createVision({
      messages: [{ role: "user", content }],
      thinking: { type: "disabled" },
    });
    return {
      text: res.choices[0]?.message?.content || "",
      model: "zai-vision",
    };
  }

  const messages = req.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const res = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
  });
  return {
    text: res.choices[0]?.message?.content || "",
    model: "zai-chat",
    tokensIn: (res.usage as { prompt_tokens?: number } | undefined)?.prompt_tokens,
    tokensOut: (res.usage as { completion_tokens?: number } | undefined)?.completion_tokens,
  };
}

async function callOpenai(req: AIRequest): Promise<AIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada en el servidor.");
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = openaiModel(req);

  const messages = req.messages.map((m) => {
    if (req.images && req.images.length > 0 && m.role === "user") {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          ...req.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Proveedor de IA respondió ${res.status}. ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content || "",
    model,
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}

export async function aiComplete(req: AIRequest): Promise<AIResult> {
  const provider = aiProviderName();
  try {
    if (provider === "openai") return await callOpenai(req);
    return await callZai(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new AiUnavailableError(msg);
  }
}

export class AiUnavailableError extends Error {
  constructor(detail?: string) {
    super(detail || "");
    this.name = "AiUnavailableError";
  }
}
