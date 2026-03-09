import { useState, useRef, useEffect } from "react";
import { Plus, Loader, RefreshCw, Mic, MicOff } from "lucide-react";
import { TOPICS } from "../lib/topics";
import { addNote, updateNote, deleteNote, saveTopicAlert } from "../lib/db";
import { analyzeTopicNotes, cleanTranscript } from "../lib/ai";
import NoteCard from "./NoteCard";

/**
 * Renders the 3-topic tabbed interface for a child.
 * - Each tab shows notes belonging to that topic
 * - Each tab has an "Analyze" button that runs the topic's hardcoded prompt
 * - Alert dots appear on tabs (and bubble up to the sidebar via onAlertChange)
 */
export default function TopicPanel({ child, notesByTopic, alerts, aiSettings, onNotesChange, onAlertChange }) {
  const [activeTopicId, setActiveTopicId] = useState(TOPICS[0].id);
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(null); // topicId currently being analyzed
  const [isListening, setIsListening] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const speechSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Stop recognition when switching tabs
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, [activeTopicId]);

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "sv-SE";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    let committedText = newContent;
    let lastFinalIndex = 0;

    recognition.onresult = (e) => {
      let newFinal = "";
      let interim = "";
      for (let i = lastFinalIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newFinal += e.results[i][0].transcript;
          lastFinalIndex = i + 1;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      committedText += newFinal;
      setNewContent(committedText + interim);
    };

    recognition.onend = async () => {
      setIsListening(false);
      const raw = committedText;
      if (!raw.trim()) return;
      setCleaningUp(true);
      try {
        const cleaned = await cleanTranscript(aiSettings, raw);
        setNewContent(cleaned);
      } finally {
        setCleaningUp(false);
      }
    };
    recognition.onerror = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  }

  const activeTopic = TOPICS.find((t) => t.id === activeTopicId);
  const activeNotes = notesByTopic[activeTopicId] ?? [];

  async function handleAddNote() {
    const content = newContent.trim();
    if (!content) return;
    setSaving(true);
    try {
      const id = await addNote(child.id, activeTopicId, content);
      const newNote = {
        id,
        child_id: child.id,
        topic_id: activeTopicId,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onNotesChange(activeTopicId, [newNote, ...activeNotes]);
      setNewContent("");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateNote(id, content) {
    await updateNote(id, content);
    onNotesChange(
      activeTopicId,
      activeNotes.map((n) => (n.id === id ? { ...n, content, updated_at: new Date().toISOString() } : n))
    );
  }

  async function handleDeleteNote(id) {
    await deleteNote(id);
    onNotesChange(activeTopicId, activeNotes.filter((n) => n.id !== id));
  }

  async function handleAnalyze() {
    if (!aiSettings || analyzing) return;
    setAnalyzing(activeTopicId);
    try {
      const raw = await analyzeTopicNotes(aiSettings, child.name, activeNotes, activeTopic.prompt);

      let parsed;
      try {
        // Strip possible markdown code fences before parsing
        const clean = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        // If JSON parsing fails, treat as yellow (cautious default)
        parsed = { alertLevel: "yellow", summary: raw.slice(0, 300) };
      }

      const level = ["ok", "yellow", "red"].includes(parsed.alertLevel) ? parsed.alertLevel : "yellow";
      const summary = parsed.summary ?? raw.slice(0, 300);
      const suggestion = parsed.suggestion ?? null;

      await saveTopicAlert(child.id, activeTopicId, level, summary, suggestion);
      onAlertChange(activeTopicId, level, summary, suggestion);
    } finally {
      setAnalyzing(null);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote();
  }

  const currentAlert = alerts[activeTopicId];

  return (
    <div className="topic-panel">
      {/* Tab bar */}
      <div className="topic-tabs">
        {TOPICS.map((topic) => {
          const alert = alerts[topic.id];
          return (
            <button
              key={topic.id}
              className={`topic-tab ${activeTopicId === topic.id ? "active" : ""}`}
              onClick={() => { setActiveTopicId(topic.id); setNewContent(""); }}
            >
              {topic.label}
              {alert && alert.level !== "ok" && (
                <span className={`alert-dot ${alert.level}`} title={alert.response ?? ""} />
              )}
            </button>
          );
        })}
      </div>

      {/* Active topic content */}
      <div className="topic-content">
        {/* Note composer */}
        <div className="note-composer">
          <div className="composer-label">New entry — {activeTopic.label}</div>
          <textarea
            ref={textareaRef}
            className={`composer-textarea${isListening ? " listening" : ""}`}
            placeholder="Document observations, behaviors, milestones…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
          />
          <div className="composer-footer">
            <span className="composer-hint">⌘ + Enter to save</span>
            <div className="composer-actions">
              {speechSupported && (
                <button
                  className={`mic-btn${isListening ? " active" : ""}`}
                  onClick={toggleListening}
                  disabled={cleaningUp}
                  title={isListening ? "Stop recording" : "Dictate note"}
                  type="button"
                >
                  {cleaningUp
                    ? <><Loader size={14} className="spin" /> Cleaning up…</>
                    : isListening
                      ? <><MicOff size={14} /> Stop</>
                      : <><Mic size={14} /> Dictate</>
                  }
                </button>
              )}
              <button
                className="composer-submit"
                onClick={handleAddNote}
                disabled={!newContent.trim() || saving}
              >
                {saving ? <Loader size={14} className="spin" /> : <Plus size={14} />}
                Add Entry
              </button>
            </div>
          </div>
        </div>

        {/* AI Analyze bar */}
        <div className="topic-analyze-bar">
          {currentAlert ? (
            <div className={`topic-alert-result ${currentAlert.level}`}>
              <span className={`alert-dot ${currentAlert.level}`} />
              <div className="topic-alert-texts">
                <span className="topic-alert-summary">{currentAlert.response}</span>
                {currentAlert.suggestion && (
                  <span className="topic-alert-suggestion">💡 {currentAlert.suggestion}</span>
                )}
              </div>
            </div>
          ) : (
            <span className="topic-analyze-hint">Run an analysis to assess this topic</span>
          )}
          <button
            className="topic-analyze-btn"
            onClick={handleAnalyze}
            disabled={analyzing !== null || !aiSettings}
            title={!aiSettings ? "Configure AI in Settings first" : ""}
          >
            {analyzing === activeTopicId ? (
              <><Loader size={13} className="spin" /> Analyzing…</>
            ) : (
              <><RefreshCw size={13} /> Analyze</>
            )}
          </button>
        </div>

        {/* Notes list */}
        {activeNotes.length === 0 ? (
          <div className="notes-empty">
            <div className="notes-empty-icon">📝</div>
            <p>No entries yet for {activeTopic.label}. Start documenting above.</p>
          </div>
        ) : (
          <div className="notes-list">
            {activeNotes.map((note, i) => (
              <NoteCard
                key={note.id}
                note={note}
                index={i}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
