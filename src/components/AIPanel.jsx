import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import { sendToAI } from "../lib/ai";
import { saveAiSummary } from "../lib/db";

const QUICK_PROMPTS = [
  "Summarize recent progress",
  "Identify patterns in behavior",
  "Suggest areas to focus on",
  "Any concerns to flag?",
];

export default function AIPanel({ child, notes, aiSettings }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const providerLabel = aiSettings?.provider === "claude"
    ? `Claude (${aiSettings.claude_model?.split("-").slice(1, 3).join(" ") ?? "AI"})`
    : `Ollama · ${aiSettings?.ollama_model ?? "model"}`;

  async function handleSend(promptOverride) {
    const userText = (promptOverride || input).trim();
    if (!userText || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const reply = await sendToAI(aiSettings, child.name, notes, userText);
      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
      // Persist the exchange to Supabase (fire-and-forget)
      saveAiSummary(child.id, userText, reply).catch(console.error);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <Sparkles size={15} />
          <span>AI Assistant</span>
        </div>
        <div className="ai-provider-badge">{providerLabel}</div>
      </div>

      {/* Quick prompts shown when no conversation has started yet */}
      {messages.length === 0 && (
        <div className="ai-quick-prompts">
          <div className="ai-welcome">
            <Bot size={28} className="ai-welcome-icon" />
            <p>Ask questions about {child.name}'s documentation</p>
          </div>
          <div className="quick-prompt-grid">
            {QUICK_PROMPTS.map((p) => (
              <button key={p} className="quick-prompt-btn" onClick={() => handleSend(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message history */}
      <div className="ai-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role}`}>
            {msg.role === "ai" && (
              <div className="ai-message-avatar">
                <Bot size={13} />
              </div>
            )}
            <div className="ai-message-bubble">
              {msg.text.split("\n").map((line, j) => (
                <span key={j}>{line}{j < msg.text.split("\n").length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-message ai">
            <div className="ai-message-avatar">
              <Bot size={13} />
            </div>
            <div className="ai-message-bubble ai-thinking">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        )}

        {error && (
          <div className="ai-error">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div className="ai-input-row">
        {messages.length > 0 && (
          <button className="ai-clear-btn" onClick={() => setMessages([])} title="Clear chat">
            <RefreshCw size={13} />
          </button>
        )}
        <textarea
          className="ai-input"
          placeholder="Ask about this child's documentation…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={loading}
        />
        <button
          className="ai-send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          {loading ? <Loader size={15} className="spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}
