// src/lib/ai.js
// Unified AI provider — supports Anthropic Claude (cloud) and Ollama (local)

/**
 * Send notes + an optional user question to the configured AI provider.
 *
 * @param {object} settings  - AI settings from the DB
 * @param {string} childName - Name of the child being documented
 * @param {Array}  notes     - Array of note objects { content, created_at }
 * @param {string} userPrompt - Optional extra instruction from the user
 * @returns {Promise<string>} AI response text
 */
export async function sendToAI(settings, childName, notes, userPrompt = "") {
  const notesText = notes
    .map((n) => `[${new Date(n.created_at).toLocaleString()}]\n${n.content}`)
    .join("\n\n---\n\n");

  const contextMessage = `You are reviewing documentation for a child named "${childName}".

Here are the documented notes in reverse chronological order:

${notesText || "(No notes yet)"}

${userPrompt ? `\nUser's question/request: ${userPrompt}` : "Please provide a brief summary and any observations."}`;

  if (settings.provider === "claude") {
    return await sendToClaude(settings, contextMessage);
  } else if (settings.provider === "ollama") {
    return await sendToOllama(settings, contextMessage);
  } else {
    throw new Error(`Unknown AI provider: ${settings.provider}`);
  }
}

// ── Anthropic Claude ─────────────────────────────────────────────────────────

async function sendToClaude(settings, message) {
  if (!settings.claude_api_key) {
    throw new Error("Anthropic API key is not configured. Please add it in Settings.");
  }

  const url = import.meta.env.PROD
    ? "https://api.anthropic.com/v1/messages"
    : "/anthropic/v1/messages";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.claude_api_key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.claude_model || "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: settings.system_prompt,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Claude API error ${response.status}: ${err?.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "(No response)";
}

// ── Ollama (local) ────────────────────────────────────────────────────────────

async function sendToOllama(settings, message) {
  const baseUrl = (settings.ollama_base_url || "http://localhost:11434").replace(/\/$/, "");
  const model = settings.ollama_model || "llama3";

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: settings.system_prompt },
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama error ${response.status}: ${response.statusText}. Is Ollama running at ${baseUrl}?`
    );
  }

  const data = await response.json();
  return data.message?.content ?? "(No response)";
}

/**
 * Stream version for Ollama — calls onChunk(text) as tokens arrive.
 * Claude streaming could be added similarly via SSE.
 */
export async function streamFromOllama(settings, childName, notes, userPrompt, onChunk) {
  const baseUrl = (settings.ollama_base_url || "http://localhost:11434").replace(/\/$/, "");
  const model = settings.ollama_model || "llama3";

  const notesText = notes
    .map((n) => `[${new Date(n.created_at).toLocaleString()}]\n${n.content}`)
    .join("\n\n---\n\n");

  const message = `Reviewing notes for "${childName}":\n\n${notesText}\n\n${userPrompt || "Summarize."}`;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: settings.system_prompt },
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Ollama stream error ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n").filter(Boolean)) {
      try {
        const json = JSON.parse(line);
        if (json.message?.content) onChunk(json.message.content);
      } catch {}
    }
  }
}
