// Streaming chat across AI providers. The user brings their own key; nothing
// is proxied through NULL VOID servers. Every provider yields the same events:
//   { type: "text", text } | { type: "thinking", text } |
//   { type: "done", stopReason, model, usage } | { type: "refusal", message }

import Anthropic from "../../vendor/anthropic-sdk.mjs";
import { parseSSE } from "../sse.js";
import { ANTHROPIC_MODELS } from "./models.js";

export { ANTHROPIC_MODELS };

// Server-side refusal fallback ("default" routing) is available for these.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

export class AiConfigError extends Error {}

export function friendlyAnthropicError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "Anthropic rejected the API key. Check it in Settings → AI Assistant.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key is not allowed to use that model.";
  if (err instanceof Anthropic.NotFoundError) return "Model not found — pick another model in Settings.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by Anthropic. Wait a moment and try again.";
  if (err instanceof Anthropic.BadRequestError) return `Request rejected: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the Anthropic API (network error).";
  if (err instanceof Anthropic.APIUserAbortError) return "Stopped.";
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status ?? ""}: ${err.message}`;
  return err?.message || String(err);
}

async function* anthropicStream({ apiKey, model, effort, system, messages, signal }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  const params = {
    model,
    max_tokens: 64000,
    system,
    messages,
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort },
  };
  let stream;
  if (FALLBACK_MODELS.has(model)) {
    stream = client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }, { signal });
  } else {
    stream = client.messages.stream(params, { signal });
  }
  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") yield { type: "text", text: event.delta.text };
        else if (event.delta.type === "thinking_delta" && event.delta.thinking) yield { type: "thinking", text: event.delta.thinking };
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield { type: "refusal", message: final.stop_details?.explanation || "The model declined this request." };
    }
    yield { type: "done", stopReason: final.stop_reason, model: final.model, usage: final.usage };
  } catch (err) {
    throw new Error(friendlyAnthropicError(err), { cause: err });
  }
}

async function* openAiStream({ baseUrl, apiKey, model, system, messages, signal }) {
  if (!model) throw new AiConfigError("Set a model for the OpenAI-compatible provider in Settings.");
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!res.ok) throw new Error(`Provider returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let stopReason = null, usage = null;
  for await (const evt of parseSSE(res.body)) {
    if (evt.data === "[DONE]") break;
    let json;
    try {
      json = JSON.parse(evt.data);
    } catch {
      continue;
    }
    const choice = json.choices?.[0];
    if (choice?.delta?.content) yield { type: "text", text: choice.delta.content };
    if (choice?.delta?.reasoning_content) yield { type: "thinking", text: choice.delta.reasoning_content };
    if (choice?.finish_reason) stopReason = choice.finish_reason;
    if (json.usage) usage = json.usage;
  }
  yield { type: "done", stopReason, model, usage };
}

async function* geminiStream({ apiKey, model, system, messages, signal }) {
  if (!model) throw new AiConfigError("Set a Gemini model in Settings.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    }),
  });
  if (!res.ok) throw new Error(`Gemini returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  let stopReason = null, usage = null;
  for await (const evt of parseSSE(res.body)) {
    let json;
    try {
      json = JSON.parse(evt.data);
    } catch {
      continue;
    }
    const cand = json.candidates?.[0];
    for (const part of cand?.content?.parts ?? []) {
      if (part.text) yield { type: part.thought ? "thinking" : "text", text: part.text };
    }
    if (cand?.finishReason) stopReason = cand.finishReason;
    if (json.usageMetadata) usage = json.usageMetadata;
  }
  yield { type: "done", stopReason, model, usage };
}

/**
 * @param {{ settings: object, secrets: object, system: string, messages: {role:string, content:string}[], signal?: AbortSignal }} req
 */
export function streamChat({ settings, secrets, system, messages, signal }) {
  const ai = settings.ai;
  switch (ai.provider) {
    case "anthropic":
      if (!secrets.anthropicKey) throw new AiConfigError("Add your Anthropic API key in Settings → AI Assistant.");
      return anthropicStream({ apiKey: secrets.anthropicKey, model: ai.anthropicModel, effort: ai.effort, system, messages, signal });
    case "openai":
      return openAiStream({ baseUrl: ai.openaiBaseUrl, apiKey: secrets.openaiKey, model: ai.openaiModel, system, messages, signal });
    case "gemini":
      if (!secrets.geminiKey) throw new AiConfigError("Add your Gemini API key in Settings → AI Assistant.");
      return geminiStream({ apiKey: secrets.geminiKey, model: ai.geminiModel, system, messages, signal });
    default:
      throw new AiConfigError(`Unknown AI provider "${ai.provider}"`);
  }
}

/** List models offered by an OpenAI-compatible or Gemini endpoint. */
export async function listModels(provider, { baseUrl, apiKey }) {
  if (provider === "openai") {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.data ?? json.models ?? []).map((m) => m.id ?? m.name).filter(Boolean).sort();
  }
  if (provider === "gemini") {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": apiKey } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, "")).sort();
  }
  return ANTHROPIC_MODELS.map((m) => m.id);
}
