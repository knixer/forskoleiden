import { useState } from "react";
import { X, Eye, EyeOff, Save, Bot, Cpu } from "lucide-react";
import { saveAiSettings } from "../lib/db";

export default function SettingsModal({ initial, onSave, onClose }) {
  const [settings, setSettings] = useState({ ...initial });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveAiSettings(settings);
      onSave(settings);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">AI Settings</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Provider toggle */}
          <div className="settings-section">
            <label className="settings-label">AI Provider</label>
            <div className="provider-toggle">
              <button
                className={`provider-btn ${settings.provider === "claude" ? "active" : ""}`}
                onClick={() => set("provider", "claude")}
              >
                <Bot size={16} />
                Claude (Cloud)
              </button>
              <button
                className={`provider-btn ${settings.provider === "ollama" ? "active" : ""}`}
                onClick={() => set("provider", "ollama")}
              >
                <Cpu size={16} />
                Ollama (Local)
              </button>
            </div>
          </div>

          {/* Claude settings */}
          {settings.provider === "claude" && (
            <div className="settings-group">
              {/* Only show API key input if no app-level key is configured */}
              {!import.meta.env.VITE_ANTHROPIC_API_KEY && (
                <div className="settings-section">
                  <label className="settings-label">Anthropic API Key</label>
                  <div className="input-with-icon">
                    <input
                      type={showKey ? "text" : "password"}
                      className="settings-input"
                      placeholder="sk-ant-…"
                      value={settings.claude_api_key || ""}
                      onChange={(e) => set("claude_api_key", e.target.value)}
                    />
                    <button className="input-icon-btn" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="settings-hint">
                    Get your key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>
                  </p>
                </div>
              )}
              <div className="settings-section">
                <label className="settings-label">Model</label>
                <select
                  className="settings-input"
                  value={settings.claude_model || "claude-sonnet-4-20250514"}
                  onChange={(e) => set("claude_model", e.target.value)}
                >
                  <option value="claude-opus-4-20250514">Claude Opus 4 (most capable)</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (recommended)</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest)</option>
                </select>
              </div>
            </div>
          )}

          {/* Ollama settings */}
          {settings.provider === "ollama" && (
            <div className="settings-group">
              <div className="settings-section">
                <label className="settings-label">Ollama Base URL</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="http://localhost:11434"
                  value={settings.ollama_base_url || ""}
                  onChange={(e) => set("ollama_base_url", e.target.value)}
                />
                <p className="settings-hint">Ollama must be running locally. Install at <a href="https://ollama.ai" target="_blank" rel="noreferrer">ollama.ai</a></p>
              </div>
              <div className="settings-section">
                <label className="settings-label">Model Name</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="llama3"
                  value={settings.ollama_model || ""}
                  onChange={(e) => set("ollama_model", e.target.value)}
                />
                <p className="settings-hint">Run <code>ollama pull llama3</code> to download a model</p>
              </div>
            </div>
          )}

          {/* System prompt */}
          <div className="settings-section">
            <label className="settings-label">System Prompt</label>
            <textarea
              className="settings-input"
              rows={4}
              value={settings.system_prompt || ""}
              onChange={(e) => set("system_prompt", e.target.value)}
              placeholder="Instructions for how the AI should behave…"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
