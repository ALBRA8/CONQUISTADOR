import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, checkQuota, consumeQuota, audit, jsonError, DAILY_LIMIT } from "@/lib/apiHelpers";
import { aiComplete, AiUnavailableError, type AIMessage } from "@/lib/ai/provider";
import {
  COACH_SYSTEM_PREFIX_ACTIONS,
  buildVariantInstruction,
} from "./coachExtras";
import { parseCoachBlocks, blocksAreComplete, extractJson, validateMessageLength } from "@/lib/ai/blocks";
import { buildCoachMessages } from "@/lib/ai/prompt";
import { detectProtocol, type ProtocolId, PROTOCOL_TOTAL_STEPS } from "@/lib/ai/protocols";
import { localModerate, conversationStopped, STOP_CARD_TEXT } from "@/lib/ai/moderator";
import {
  ANALYZE_SYSTEM, OPTIONS_SYSTEM, DEEP_ANALYSIS_SYSTEM, PROFILE_SYSTEM, PLANNER_SYSTEM,
  SIMULATOR_SYSTEM, DATE_BRIEF_SYSTEM, DATE_DEBRIEF_SYSTEM, FIRST_MESSAGE_SYSTEM,
  TONE_SYSTEM, MODERATOR_SYSTEM, ACHIEVEMENT_SYSTEM, IN_DATE_SYSTEM, DIAGNOSTIC_SYSTEM,
} from "@/lib/ai/coachInstructions";
import { computeUserStats } from "@/lib/stats";
import { grantAuto } from "@/lib/achievements";

const TZ_DEFAULT = "America/Bogota";

type Body = Record<string, unknown>;

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("res" in auth) return auth.res;
  const user = auth.user;

  const body = (await req.json().catch(() => null)) as Body | null;
  const action = typeof body?.action === "string" ? body.action : "";
  if (!action) return jsonError("Falta la acción a ejecutar.", 400, "no_action");

  const quota = await checkQuota(user);
  if (!quota.ok) return quota.res;

  try {
    const result = await dispatch(action, body || {}, auth.user);
    if (!result.skipQuota) await consumeQuota(auth.user.id);
    return NextResponse.json(result.payload);
  } catch (e) {
    if (e instanceof AiUnavailableError) {
      return jsonError(
        "El asistente no responde ahora mismo. Espera unos segundos y vuelve a intentar.",
        503,
        "ai_unavailable"
      );
    }
    if (e instanceof AiActionError) {
      return jsonError(e.message, e.status, e.code);
    }
    console.error("[/api/ai] error en acción", action, e);
    return jsonError("Algo salió mal con la consulta. Vuelve a intentar.", 500, "unknown");
  }
}

class AiActionError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type DispatchResult = { payload: Record<string, unknown>; skipQuota?: boolean };

async function dispatch(action: string, body: Body, user: { id: string; toneDefault: string; lengthPref: string }): Promise<DispatchResult> {
  switch (action) {
    case "coach":
      return coach(body, user);
    case "analyze":
      return analyze(body, user.id);
    case "options":
      return options(body, user);
    case "deep":
      return deep(body, user.id);
    case "profile":
      return profile(body, user.id);
    case "planner":
      return planner(user.id);
    case "simulate":
      return simulate(body, user);
    case "date_brief":
      return dateBrief(body, user.id);
    case "date_debrief":
      return dateDebrief(body, user.id);
    case "in_date":
      return inDate(body);
    case "first_messages":
      return firstMessages(body);
    case "tone":
      return tone(body, user.toneDefault);
    case "moderate":
      return moderate(body);
    case "achievement_verify":
      return achievementVerify(body);
    case "diagnostic":
      return diagnostic(body);
    default:
      throw new AiActionError("Acción de IA desconocida.", 400, "bad_action");
  }
}

// ---------- Contexto compartido ----------

async function loadWoman(userId: string, womanId?: string) {
  if (!womanId) return null;
  const woman = await db.woman.findFirst({ where: { id: womanId, userId, archivedAt: null } });
  return woman;
}

async function lastAnalysisMessageId(womanId: string) {
  const lastHer = await db.message.findFirst({
    where: { womanId, sender: "her" },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
  });
  return lastHer?.id ?? null;
}

// ---------- 1. COACH PRINCIPAL ----------

async function coach(body: Body, user: { id: string; toneDefault: string; lengthPref: string }): Promise<DispatchResult> {
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) throw new AiActionError("Escribe qué quieres consultar.", 400, "empty");

  const woman = await loadWoman(user.id, typeof body.womanId === "string" ? body.womanId : undefined);
  if (!woman) throw new AiActionError("Abre primero la ficha de una persona para usar el coach.", 400, "no_woman");

  // Hilo del coach por mujer (persistente: salir y volver no pierde el punto)
  let thread = await db.coachThread.findFirst({
    where: { userId: user.id, womanId: woman.id },
    orderBy: { updatedAt: "desc" },
  });
  if (!thread) {
    thread = await db.coachThread.create({ data: { userId: user.id, womanId: woman.id } });
  }

  // Comandos de control de protocolo
  const lower = message.toLowerCase();
  if (/\b(sin protocolo|quit(ar|a) (el )?protocolo|empezar de cero)\b/.test(lower)) {
    thread = await db.coachThread.update({ where: { id: thread.id }, data: { protocol: "none", step: 0, state: null } });
  }

  // Detector de protocolo por palabras clave (no IA)
  let protocol: ProtocolId = thread.protocol as ProtocolId;
  let step = thread.step;
  if (protocol === "none") {
    const detected = detectProtocol(message);
    if (detected !== "none") {
      protocol = detected;
      step = 0;
    }
  }

  // Moderación local del mensaje del usuario (capa rápida, sin IA)
  const mod = localModerate(message);
  if (mod.viola) {
    await db.coachTurn.create({
      data: {
        threadId: thread.id,
        role: "assistant",
        content: STOP_CARD_TEXT,
        blocks: JSON.stringify({ alto: true, motivoAlto: mod.motivo, raw: STOP_CARD_TEXT }),
      },
    });
    await audit(user.id, "moderation_stop", { tipo: mod.tipo, womanId: woman.id });
    return {
      payload: {
        blocks: { alto: true, motivoAlto: mod.motivo, raw: STOP_CARD_TEXT },
        thread: { id: thread.id, protocol, step },
        quotaLeft: Math.max(0, DAILY_LIMIT - (await db.user.findUnique({ where: { id: user.id } }))!.dailyCallsUsed),
      },
      skipQuota: true,
    };
  }

  // Regla de parada sobre el historial de ELLA
  const herMessages = await db.message.findMany({
    where: { womanId: woman.id, sender: "her" },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
  const stopped = conversationStopped(herMessages.map((m) => m.body));

  // Últimos turnos del coach para continuidad
  const recentTurns = await db.coachTurn.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const stats = await computeUserStats(user.id);
  const variant = typeof body.variant === "string" ? body.variant : undefined;
  const variantNote = buildVariantInstruction(variant);

  const historyMode = /\b(analiz|revisen|revisa)\b/.test(message) ? "analisis" : "normal";

  const baseMessages = buildCoachMessages({
    woman,
    messages: await db.message.findMany({ where: { womanId: woman.id } }),
    userMessage: variant ? `${variantNote}\n\n(Refinamiento pedido sobre tu respuesta anterior: ${message})` : message,
    protocol,
    protocolStep: step,
    stats: { mensajesEnviados: stats.mensajesEnviados, tasaRespuesta: stats.tasaRespuesta, citasConcretadas: stats.citasHechas },
    tone: user.toneDefault,
    lengthPref: user.lengthPref,
    mode: historyMode as "normal" | "analisis",
    tz: TZ_DEFAULT,
    conversationStopped: stopped,
  });

  const messages: AIMessage[] = [...baseMessages];
  if (recentTurns.length > 0) {
    const compact = recentTurns
      .reverse()
      .map((t) => `${t.role === "user" ? "USUARIO" : "COACH"}: ${t.content.slice(0, 300)}`)
      .join("\n---\n");
    messages.splice(1, 0, {
      role: "user",
      content: `CONVERSACIÓN PREVIA CON EL COACH (para continuidad):\n${compact}`,
    });
    messages.splice(2, 0, {
      role: "assistant",
      content: "Entendido. Continúo con el siguiente turno manteniendo ese hilo.",
    });
  }

  const result = await aiComplete({ messages, quality: "fast", temperature: 0.7 });
  let raw = result.text;
  let blocks = parseCoachBlocks(raw);

  // Si no llegaron los bloques completos: un reintento con recordatorio de formato
  if (!blocksAreComplete(blocks) && !blocks.alto) {
    const retry = await aiComplete({
      messages: [
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "Tu respuesta no llegó con las cinco etiquetas [LECTURA] [ACCION] [MENSAJE] [HORA] [SI]. Reescríbela SOLO con esas cinco etiquetas, cada una con su contenido.",
        },
      ],
      quality: "fast",
      temperature: 0.5,
    });
    raw = retry.text;
    blocks = parseCoachBlocks(raw);
  }

  // Validación de longitud del mensaje sugerido (sección 15.3)
  if (blocks.mensaje && !/SIN MENSAJE/i.test(blocks.mensaje)) {
    const isFirst = woman.stage === "primer_mensaje";
    const check = validateMessageLength(blocks.mensaje, { isFirst, herLastLength: undefined });
    if (!check.ok) {
      const shorten = await aiComplete({
        messages: [
          ...messages,
          { role: "assistant", content: raw },
          { role: "user", content: `El mensaje propuesto se pasa de longitud: ${check.reason} Devuelve la respuesta completa en el mismo formato de etiquetas con un [MENSAJE] más corto.` },
        ],
        quality: "fast",
        temperature: 0.5,
      });
      const retryBlocks = parseCoachBlocks(shorten.text);
      if (blocksAreComplete(retryBlocks)) blocks = retryBlocks;
    }
  }

  // Avance de fase del protocolo mediante el marcador [FASE n]
  const faseMatch = /\[FASE\s+(\d+)\]/i.exec(raw);
  let newStep = step;
  if (protocol !== "none" && faseMatch) {
    const fase = Math.max(1, Math.min(PROTOCOL_TOTAL_STEPS[protocol as Exclude<ProtocolId, "none">], parseInt(faseMatch[1], 10)));
    newStep = Math.min(fase, PROTOCOL_TOTAL_STEPS[protocol as Exclude<ProtocolId, "none">]);
  } else if (protocol !== "none" && blocks.mensaje && !/SIN MENSAJE/i.test(blocks.mensaje)) {
    // Entregó mensaje final: protocolo completado
    newStep = PROTOCOL_TOTAL_STEPS[protocol as Exclude<ProtocolId, "none">];
  }

  await db.coachThread.update({
    where: { id: thread.id },
    data: { protocol, step: newStep, updatedAt: new Date() },
  });

  await db.coachTurn.create({
    data: { threadId: thread.id, role: "user", content: message },
  });
  await db.coachTurn.create({
    data: {
      threadId: thread.id,
      role: "assistant",
      content: raw,
      blocks: JSON.stringify(blocks),
      promptSent: messages.map((m) => `${m.role}: ${m.content.slice(0, 500)}`).join("\n\n").slice(0, 20000),
      model: result.model,
      tokensIn: result.tokensIn ?? null,
      tokensOut: result.tokensOut ?? null,
    },
  });

  // Registrar sugerencia entregable (para "marcar como enviado" y outcomes)
  let suggestionId: string | null = null;
  if (blocks.mensaje && !/SIN MENSAJE/i.test(blocks.mensaje) && !blocks.alto) {
    const s = await db.suggestion.create({
      data: {
        womanId: woman.id,
        options: JSON.stringify([{ texto: blocks.mensaje, tipo: "coach", cuando_enviar: blocks.hora }]),
      },
    });
    suggestionId = s.id;
  }

  return {
    payload: {
      blocks,
      suggestionId,
      thread: { id: thread.id, protocol, step: newStep, total: protocol !== "none" ? PROTOCOL_TOTAL_STEPS[protocol as Exclude<ProtocolId, "none">] : 0 },
      quotaLeft: Math.max(0, DAILY_LIMIT - (await db.user.findUnique({ where: { id: user.id } }))!.dailyCallsUsed),
    },
  };
}

// ---------- 2. ANALIZADOR DE MENSAJE (RADIOGRAFÍA) ----------

type Metrics = {
  interes?: number; atraccion?: number; comodidad?: number; deseo_verte?: number; prob_cita?: number;
  estado?: string; tendencia?: string; momento_cita?: string; motivo?: string;
};

async function analyze(body: Body, userId: string): Promise<DispatchResult> {
  const woman = await loadWoman(userId, typeof body.womanId === "string" ? body.womanId : undefined);
  if (!woman) throw new AiActionError("Abre una ficha para analizar.", 400, "no_woman");
  const messages = await db.message.findMany({ where: { womanId: woman.id } });
  if (messages.length === 0) throw new AiActionError("No hay mensajes que analizar en esta ficha.", 400, "no_messages");

  const history = buildCoachMessages({
    woman,
    messages,
    userMessage: "Analiza el último mensaje de ella y da la radiografía.",
    protocol: "none",
    protocolStep: 0,
    stats: { mensajesEnviados: 0, tasaRespuesta: 0, citasConcretadas: 0 },
    mode: "analisis",
    tz: TZ_DEFAULT,
  });

  const result = await aiComplete({
    messages: [
      { role: "system", content: ANALYZE_SYSTEM },
      ...history.slice(0, 1),
      { role: "user", content: `${history[1].content}\n\nAnaliza el ÚLTIMO mensaje de ELLA del historial y devuelve SOLO el JSON de la radiografía.` },
    ],
    quality: "fast",
    temperature: 0.3,
  });

  const metrics = extractJson<Metrics>(result.text);
  if (!metrics?.interes) {
    const retry = await aiComplete({
      messages: [
        { role: "system", content: ANALYZE_SYSTEM },
        ...history.slice(0, 1),
        { role: "user", content: `${history[1].content}\n\nDevuelve SOLO el JSON válido de la radiografía (tu respuesta anterior no fue JSON válido).` },
      ],
      quality: "fast",
      temperature: 0.2,
    });
    const retryMetrics = extractJson<Metrics>(retry.text);
    if (!retryMetrics?.interes) {
      throw new AiActionError("El análisis no salió bien esta vez. Vuelve a intentar en unos segundos.", 502, "bad_json");
    }
    await saveAnalysis(retryMetrics, retry.text, retry.model, woman.id, userId);
    return { payload: { metrics: retryMetrics, model: retry.model } };
  }

  await saveAnalysis(metrics, result.text, result.model, woman.id, userId);
  return { payload: { metrics, model: result.model } };
}

async function saveAnalysis(metrics: Metrics, rawText: string, model: string, womanId: string, userId: string) {
  const messageId = await lastAnalysisMessageId(womanId);
  await db.analysis.create({
    data: {
      womanId,
      messageId,
      kind: "radiografia",
      metrics: JSON.stringify(metrics),
      summary: metrics.motivo || null,
      model,
    },
  });
  // Actualizar estado e interés de la ficha con lo estimado
  const estadoMap: Record<string, string> = { frio: "frio", tibio: "tibio", caliente: "caliente", sinrespuesta: "sinrespuesta" };
  const data: Record<string, unknown> = {};
  if (metrics.estado && estadoMap[metrics.estado]) data.status = estadoMap[metrics.estado];
  if (typeof metrics.interes === "number") data.interestLevel = Math.min(Math.max(Math.round(metrics.interes), 0), 100);
  await db.woman.update({ where: { id: womanId }, data });
  await grantAuto(userId, "primera_radiografia");
}

// ---------- 3. ANALIZADOR PROFUNDO DE CHAT ----------

async function deep(body: Body, userId: string): Promise<DispatchResult> {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw new AiActionError("Pega la conversación que quieres que analice.", 400, "empty");
  if (text.length > 12000) throw new AiActionError("Máximo 12.000 caracteres por análisis. Divide el chat.", 400, "too_long");

  const result = await aiComplete({
    messages: [
      { role: "system", content: DEEP_ANALYSIS_SYSTEM },
      { role: "user", content: `Analiza esta conversación pegada a mano:\n\n${text}` },
    ],
    quality: "best",
    temperature: 0.4,
  });
  const parsed = extractJson<Record<string, unknown>>(result.text);
  if (!parsed?.lectura) {
    const retry = await aiComplete({
      messages: [
        { role: "system", content: DEEP_ANALYSIS_SYSTEM },
        { role: "user", content: `Analiza esta conversación:\n\n${text}\n\nDevuelve SOLO el JSON válido (la respuesta anterior no fue JSON válido).` },
      ],
      quality: "best",
      temperature: 0.3,
    });
    const retryParsed = extractJson<Record<string, unknown>>(retry.text);
    if (!retryParsed?.lectura) throw new AiActionError("El análisis profundo no salió bien. Intenta de nuevo.", 502, "bad_json");
    return { payload: { analysis: retryParsed } };
  }
  return { payload: { analysis: parsed } };
}

// ---------- 4. GENERADOR DE 3 OPCIONES ----------

async function options(body: Body, user: { id: string; toneDefault: string }): Promise<DispatchResult> {
  const woman = await loadWoman(user.id, typeof body.womanId === "string" ? body.womanId : undefined);
  if (!woman) throw new AiActionError("Abre una ficha para generar opciones.", 400, "no_woman");
  const messages = await db.message.findMany({ where: { womanId: woman.id } });
  if (messages.length === 0) throw new AiActionError("Añade primero algunos mensajes para tener contexto.", 400, "no_messages");

  const ctx = buildCoachMessages({
    woman,
    messages,
    userMessage: "Genera 3 opciones de mensaje distintas.",
    protocol: "none",
    protocolStep: 0,
    stats: { mensajesEnviados: 0, tasaRespuesta: 0, citasConcretadas: 0 },
    tone: user.toneDefault,
    tz: TZ_DEFAULT,
  });

  const result = await aiComplete({
    messages: [
      { role: "system", content: OPTIONS_SYSTEM },
      { role: "user", content: `${ctx[1].content}\n\nGenera las 3 opciones (casual, con gancho, que avanza) SOLO como JSON.` },
    ],
    quality: "fast",
    temperature: 0.9,
  });

  let parsed = extractJson<{ opciones?: Array<Record<string, unknown>> }>(result.text);
  if (!parsed?.opciones || !Array.isArray(parsed.opciones) || parsed.opciones.length < 3) {
    const retry = await aiComplete({
      messages: [
        { role: "system", content: OPTIONS_SYSTEM },
        { role: "user", content: `${ctx[1].content}\n\nDevuelve SOLO el JSON válido con EXACTAMENTE 3 opciones realmente distintas.` },
      ],
      quality: "fast",
      temperature: 0.8,
    });
    parsed = extractJson<{ opciones?: Array<Record<string, unknown>> }>(retry.text);
    if (!parsed?.opciones || parsed.opciones.length < 3) {
      throw new AiActionError("No salieron las 3 opciones bien distintas. Intenta de nuevo.", 502, "bad_json");
    }
    return { payload: { opciones: parsed.opciones.slice(0, 3), model: retry.model } };
  }
  return { payload: { opciones: parsed.opciones.slice(0, 3), model: result.model } };
}

// ---------- 9. PERFILADOR DE PERSONALIDAD ----------

async function profile(body: Body, userId: string): Promise<DispatchResult> {
  const woman = await loadWoman(userId, typeof body.womanId === "string" ? body.womanId : undefined);
  if (!woman) throw new AiActionError("Abre una ficha para perfilar.", 400, "no_woman");
  const messages = await db.message.findMany({ where: { womanId: woman.id } });
  if (messages.length < 4) throw new AiActionError("Con menos de 4 mensajes no hay material suficiente para un perfil.", 400, "no_material");

  const ctx = buildCoachMessages({
    woman, messages,
    userMessage: "Genera el perfil de personalidad de ella.",
    protocol: "none", protocolStep: 0,
    stats: { mensajesEnviados: 0, tasaRespuesta: 0, citasConcretadas: 0 },
    mode: "analisis", tz: TZ_DEFAULT,
  });

  const result = await aiComplete({
    messages: [
      { role: "system", content: PROFILE_SYSTEM },
      { role: "user", content: `${ctx[1].content}\n\nDevuelve SOLO el JSON del perfil.` },
    ],
    quality: "fast", temperature: 0.4,
  });
  const parsed = extractJson<Record<string, unknown>>(result.text);
  if (!parsed?.arquetipo) throw new AiActionError("El perfil no salió bien. Intenta de nuevo.", 502, "bad_json");

  await db.analysis.create({
    data: {
      womanId: woman.id,
      kind: "perfil",
      metrics: JSON.stringify(parsed),
      summary: typeof parsed.arquetipo === "string" ? parsed.arquetipo : null,
      model: result.model,
    },
  });
  if (typeof parsed.arquetipo === "string") {
    await db.woman.update({ where: { id: woman.id }, data: { archetype: parsed.arquetipo } });
  }
  return { payload: { profile: parsed, model: result.model } };
}

// ---------- 10. PLANIFICADOR DIARIO ----------

async function planner(userId: string): Promise<DispatchResult> {
  const women = await db.woman.findMany({
    where: { userId, archivedAt: null },
    include: { messages: { orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }], take: 6 }, dates: { where: { status: "agendada" } } },
  });
  if (women.length === 0) throw new AiActionError("Aún no tienes fichas activas para planificar.", 400, "empty");

  const resumen = women
    .map((w) => {
      const last = w.messages[0];
      return [
        `#${w.name} (estado: ${w.status}, interés: ${w.interestLevel}/100)`,
        w.dates[0] ? `- Cita agendada: ${w.dates[0].scheduledAt.toISOString()}` : "",
        last ? `- Último mensaje (${last.sender === "me" ? "usuario" : "ella"}): "${last.body.slice(0, 80)}"` : "- Sin mensajes aún",
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  const result = await aiComplete({
    messages: [
      { role: "system", content: PLANNER_SYSTEM },
      { role: "user", content: `FECHA ACTUAL: ${new Date().toISOString()}\n\nCONVERSACIONES ACTIVAS:\n${resumen}\n\nElige las 3 acciones de mayor valor para HOY. SOLO JSON.` },
    ],
    quality: "fast", temperature: 0.5,
  });
  const parsed = extractJson<{ acciones?: Array<Record<string, unknown>> }>(result.text);
  if (!parsed?.acciones) {
    const retry = await aiComplete({
      messages: [
        { role: "system", content: PLANNER_SYSTEM },
        { role: "user", content: `CONVERSACIONES:\n${resumen}\n\nDevuelve SOLO el JSON válido con exactamente 3 acciones.` },
      ],
      quality: "fast", temperature: 0.4,
    });
    const retryParsed = extractJson<{ acciones?: Array<Record<string, unknown>> }>(retry.text);
    if (!retryParsed?.acciones) throw new AiActionError("El plan de hoy no salió bien. Intenta de nuevo.", 502, "bad_json");
    return { payload: { acciones: retryParsed.acciones.slice(0, 3) } };
  }
  return { payload: { acciones: parsed.acciones.slice(0, 3) } };
}

// ---------- 11. SIMULADOR ----------

async function simulate(body: Body, user: { id: string; toneDefault: string }): Promise<DispatchResult> {
  const woman = await loadWoman(user.id, typeof body.womanId === "string" ? body.womanId : undefined);
  const difficulty = typeof body.difficulty === "string" ? body.difficulty : "media";
  const userTurn = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

  const womanCtx = woman
    ? `LA PERSONA QUE INTERPRETAS: ${woman.name}${woman.age ? `, ${woman.age}` : ""}${woman.archetype ? `, perfil ${woman.archetype}` : ""}, estado ${woman.status}.`
    : "LA PERSONA QUE INTERPRETAS: una persona ficticia coherente con la dificultad elegida.";

  const mod = localModerate(userTurn);
  if (mod.viola) {
    return { payload: { reply: "(El personaje se incomoda y cierra la conversación. Eso no se practica: aquí termina la escena.)", stop: true } };
  }

  const convo = history
    .map((h) => (typeof h === "object" && h && "role" in h && "content" in h ? `${(h as { role: string }).role === "user" ? "USUARIO" : "ELLA"}: ${(h as { content: string }).content.slice(0, 200)}` : ""))
    .filter(Boolean)
    .join("\n");

  const result = await aiComplete({
    messages: [
      { role: "system", content: SIMULATOR_SYSTEM },
      {
        role: "user",
        content: `${womanCtx}\nDIFICULTAD: ${difficulty}.\n${convo ? `CONVERSACIÓN HASTA AHORA:\n${convo}\n` : ""}${userTurn === "[PUNTUAR]" ? "El usuario pide puntuar la práctica. Sal del personaje y devuelve SOLO el JSON de puntuación." : `El usuario acaba de escribir: "${userTurn}". Responde como ella, 1-2 líneas, sin salir del personaje.`}`,
      },
    ],
    quality: "fast",
    temperature: difficulty === "difícil" || difficulty === "dificil" ? 0.9 : 0.7,
  });

  if (userTurn === "[PUNTUAR]") {
    const parsed = extractJson<{ puntuacion?: number; veredicto?: string; mejoras?: string[] }>(result.text);
    if (!parsed?.puntuacion) throw new AiActionError("La puntuación no salió bien. Intenta de nuevo.", 502, "bad_json");
    return { payload: { score: parsed } };
  }
  return { payload: { reply: result.text.slice(0, 800) } };
}

// ---------- 12/13/14. CITAS ----------

async function dateBrief(body: Body, userId: string): Promise<DispatchResult> {
  const dateId = typeof body.dateId === "string" ? body.dateId : "";
  const date = await db.dateEntry.findFirst({ where: { id: dateId, woman: { userId } }, include: { woman: true } });
  if (!date) throw new AiActionError("No encontré esa cita.", 404, "no_date");
  const messages = await db.message.findMany({ where: { womanId: date.womanId } });

  const ctx = buildCoachMessages({
    woman: date.woman, messages,
    userMessage: "Prepara el informe previo de la cita.",
    protocol: "none", protocolStep: 0,
    stats: { mensajesEnviados: 0, tasaRespuesta: 0, citasConcretadas: 0 },
    tz: TZ_DEFAULT,
  });

  const briefPrompt = `${ctx[1].content}\n\nCITA: ${date.scheduledAt.toISOString()} en ${date.place || "lugar por definir"}.\nDevuelve SOLO el JSON del informe previo.`;
  const result = await aiComplete({
    messages: [
      { role: "system", content: DATE_BRIEF_SYSTEM },
      { role: "user", content: briefPrompt },
    ],
    quality: "fast", temperature: 0.5,
  });
  let parsed = extractJson<Record<string, unknown>>(result.text);
  if (!parsed?.conversar) {
    const retry = await aiComplete({
      messages: [
        { role: "system", content: DATE_BRIEF_SYSTEM },
        { role: "user", content: `${briefPrompt}\n\nTu respuesta anterior no fue JSON válido. Devuelve SOLO el objeto JSON válido.` },
      ],
      quality: "fast", temperature: 0.3,
    });
    parsed = extractJson<Record<string, unknown>>(retry.text);
  }
  if (!parsed?.conversar) throw new AiActionError("El informe previo no salió bien. Intenta de nuevo.", 502, "bad_json");
  await db.dateEntry.update({ where: { id: date.id }, data: { preBriefing: JSON.stringify(parsed) } });
  return { payload: { briefing: parsed } };
}

async function dateDebrief(body: Body, userId: string): Promise<DispatchResult> {
  const dateId = typeof body.dateId === "string" ? body.dateId : "";
  const relato = typeof body.relato === "string" ? body.relato.trim().slice(0, 2000) : "";
  const date = await db.dateEntry.findFirst({ where: { id: dateId, woman: { userId } }, include: { woman: true } });
  if (!date) throw new AiActionError("No encontré esa cita.", 404, "no_date");
  if (!relato) throw new AiActionError("Cuenta cómo fue la cita (2-10 líneas).", 400, "empty");

  const mod = localModerate(relato);
  if (mod.viola) return { payload: { briefing: null, stop: true, motivo: mod.motivo } };

  const debriefPrompt = `CITA CON: ${date.woman.name}. Relato del usuario: ${relato}\nDevuelve SOLO el JSON del resumen posterior.`;
  const result = await aiComplete({
    messages: [
      { role: "system", content: DATE_DEBRIEF_SYSTEM },
      { role: "user", content: debriefPrompt },
    ],
    quality: "fast", temperature: 0.4,
  });
  let parsed = extractJson<Record<string, unknown>>(result.text);
  if (!parsed?.veredicto) {
    const retry = await aiComplete({
      messages: [
        { role: "system", content: DATE_DEBRIEF_SYSTEM },
        { role: "user", content: `${debriefPrompt}\n\nTu respuesta anterior no fue JSON válido. Devuelve SOLO el objeto JSON válido.` },
      ],
      quality: "fast", temperature: 0.3,
    });
    parsed = extractJson<Record<string, unknown>>(retry.text);
  }
  if (!parsed?.veredicto) throw new AiActionError("El resumen no salió bien. Intenta de nuevo.", 502, "bad_json");
  await db.dateEntry.update({ where: { id: date.id }, data: { debriefing: JSON.stringify(parsed) } });
  if (parsed.veredicto) await grantAuto(userId, "primera_cita_hecha");
  return { payload: { debriefing: parsed } };
}

async function inDate(body: Body): Promise<DispatchResult> {
  const situacion = typeof body.situation === "string" ? body.situation.trim().slice(0, 1500) : "";
  if (!situacion) throw new AiActionError("Cuenta en una línea qué está pasando en la cita.", 400, "empty");
  const result = await aiComplete({
    messages: [
      { role: "system", content: IN_DATE_SYSTEM },
      { role: "user", content: `SITUACIÓN EN LA CITA: ${situacion}` },
    ],
    quality: "fast", temperature: 0.6,
  });
  return { payload: { advice: result.text.slice(0, 800) } };
}

// ---------- 15. ESCRITOR DE PRIMEROS MENSAJES ----------

async function firstMessages(body: Body): Promise<DispatchResult> {
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 2000) : "";
  if (!bio) throw new AiActionError("Pega la bio de la que partir.", 400, "empty");
  const result = await aiComplete({
    messages: [
      { role: "system", content: FIRST_MESSAGE_SYSTEM },
      { role: "user", content: `BIO:\n${bio}\nDevuelve SOLO el JSON con las 3 opciones.` },
    ],
    quality: "fast", temperature: 0.9,
  });
  const parsed = extractJson<{ opciones?: Array<Record<string, unknown>> }>(result.text);
  if (!parsed?.opciones?.length) throw new AiActionError("No salieron bien los mensajes. Intenta de nuevo.", 502, "bad_json");
  return { payload: { opciones: parsed.opciones.slice(0, 3) } };
}

// ---------- 16. CAMBIADOR DE TONO ----------

const TONES = ["misterioso", "coqueto", "casual", "suave", "atrevido", "divertido", "romantico", "directo"];

async function tone(body: Body, defaultTone: string): Promise<DispatchResult> {
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  const tone = typeof body.tone === "string" && TONES.includes(body.tone) ? body.tone : defaultTone;
  if (!text) throw new AiActionError("Escribe el mensaje a reescribir.", 400, "empty");
  const result = await aiComplete({
    messages: [
      { role: "system", content: TONE_SYSTEM },
      { role: "user", content: `Reescribe en tono "${tone}":\n${text}` },
    ],
    quality: "fast", temperature: 0.8,
  });
  const parsed = extractJson<{ texto?: string; caracteres?: number }>(result.text);
  if (!parsed?.texto) throw new AiActionError("La reescritura no salió bien. Intenta de nuevo.", 502, "bad_json");
  return { payload: { tono: tone, texto: parsed.texto, caracteres: parsed.caracteres || [...parsed.texto].length } };
}

// ---------- 8. MODERADOR DE CONTENIDO ----------

async function moderate(body: Body): Promise<DispatchResult> {
  const text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";
  if (!text) throw new AiActionError("Falta el texto a revisar.", 400, "empty");
  const local = localModerate(text);
  if (local.viola) return { payload: { viola: true, tipo: local.tipo, motivo: local.motivo, parar: true } };

  const result = await aiComplete({
    messages: [
      { role: "system", content: MODERATOR_SYSTEM },
      { role: "user", content: `Revisa este texto:\n${text}` },
    ],
    quality: "fast", temperature: 0.1,
  });
  const parsed = extractJson<{ viola?: boolean; tipo?: string; motivo?: string; parar?: boolean }>(result.text);
  if (!parsed) return { payload: { viola: false, tipo: "ninguno", motivo: "", parar: false } };
  return { payload: parsed };
}

// ---------- 7. VERIFICADOR DE LOGROS ----------

async function achievementVerify(body: Body): Promise<DispatchResult> {
  const code = typeof body.code === "string" ? body.code : "";
  const title = typeof body.title === "string" ? body.title : "";
  const evidence = typeof body.evidence === "string" ? body.evidence.trim().slice(0, 2000) : "";
  if (!code || !evidence) throw new AiActionError("Falta la evidencia del logro.", 400, "empty");

  const result = await aiComplete({
    messages: [
      { role: "system", content: ACHIEVEMENT_SYSTEM },
      { role: "user", content: `MEDALLA: "${title}". EVIDENCIA DEL USUARIO:\n${evidence}\nDevuelve SOLO el JSON de verificación.` },
    ],
    quality: "fast", temperature: 0.2,
  });
  const parsed = extractJson<{ cumple?: string; cita_textual?: string; que_falta?: string }>(result.text);
  if (!parsed?.cumple) throw new AiActionError("La verificación no salió bien. Intenta de nuevo.", 502, "bad_json");
  return { payload: parsed };
}

// ---------- DIAGNÓSTICO PERSONAL 30/60/90 ----------

async function diagnostic(body: Body): Promise<DispatchResult> {
  const areas = (Array.isArray(body.areas) ? body.areas : []).filter((a): a is { nombre: string; nota: number } =>
    typeof a === "object" && a !== null && typeof (a as { nombre?: unknown }).nombre === "string" && typeof (a as { nota?: unknown }).nota === "number"
  );
  if (areas.length < 7) throw new AiActionError("Puntúa las siete áreas del 1 al 10 para armar el diagnóstico.", 400, "incomplete");

  const result = await aiComplete({
    messages: [
      { role: "system", content: DIAGNOSTIC_SYSTEM },
      { role: "user", content: `Autoevaluación del usuario:\n${areas.map((a) => `- ${a.nombre}: ${a.nota}/10`).join("\n")}\nDevuelve SOLO el JSON del plan.` },
    ],
    quality: "best", temperature: 0.5,
  });
  const parsed = extractJson<Record<string, unknown>>(result.text);
  if (!parsed?.banda) throw new AiActionError("El plan no salió bien. Intenta de nuevo.", 502, "bad_json");
  return { payload: { plan: parsed } };
}
