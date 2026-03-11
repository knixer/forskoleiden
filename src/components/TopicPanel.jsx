import { useState, useRef, useEffect } from "react";
import { Plus, Loader, RefreshCw, Mic, MicOff, CheckCircle, Calendar } from "lucide-react";
import { TOPICS } from "../lib/topics";
import { addNote, updateNote, deleteNote, saveTopicAlert, fetchActionPlans, saveActionPlan, createFollowUp } from "../lib/db";
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
  // Action plan state
  const [actionPlans, setActionPlans] = useState({}); // { topicId: plan }
  const [planDrafts, setPlanDrafts] = useState({}); // { topicId: string }
  const [planDays, setPlanDays] = useState({}); // { topicId: number }
  const [savingPlan, setSavingPlan] = useState(null); // topicId being saved
  // Manual follow-up scheduling per topic
  const [schedulingTopic, setSchedulingTopic] = useState(null); // topicId showing the schedule form
  const [scheduleDays, setScheduleDays] = useState(7);
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);
  // Which topics have their analysis detail expanded in the AP tab
  const [expandedTopics, setExpandedTopics] = useState(new Set());
  const toggleExpanded = (topicId) =>
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      next.has(topicId) ? next.delete(topicId) : next.add(topicId);
      return next;
    });
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const speechSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Load action plans whenever the child changes or the action-plan tab is opened
  useEffect(() => {
    loadActionPlans();
  }, [child.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadActionPlans() {
    try {
      const plans = await fetchActionPlans(child.id);
      setActionPlans(plans);
    } catch {
      // table may not exist yet
    }
  }

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

  // Topics that have a non-ok, non-addressed alert (need action plan)
  const alertTopics = TOPICS.filter((t) => {
    const a = alerts[t.id];
    return a && a.level !== "ok" && !t.isActionPlan;
  });
  // Topics that have been addressed (have action plan)
  const addressedTopics = TOPICS.filter((t) => {
    const a = alerts[t.id];
    return a && a.level === "addressed" && !t.isActionPlan;
  });
  const apBadgeCount = alertTopics.length; // unaddressed warnings

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

  async function handleSaveActionPlan(topicId) {
    const content = (planDrafts[topicId] ?? "").trim();
    if (!content) return;
    const days = planDays[topicId] ?? 14;
    setSavingPlan(topicId);
    try {
      const planId = await saveActionPlan(child.id, topicId, content, days);
      const newPlan = {
        id: planId,
        child_id: child.id,
        topic_id: topicId,
        content,
        follow_up_days: days,
        created_at: new Date().toISOString(),
      };
      setActionPlans((prev) => ({ ...prev, [topicId]: newPlan }));
      setPlanDrafts((prev) => ({ ...prev, [topicId]: "" }));
      // Notify parent — keep the raw level but mark as addressed
      const currentAlert = alerts[topicId];
      if (currentAlert) {
        onAlertChange(topicId, "addressed", currentAlert.response, currentAlert.suggestion, currentAlert.sources);
      }
    } finally {
      setSavingPlan(null);
    }
  }

  async function handleScheduleFollowUp(topicId) {
    const plan = actionPlans[topicId];
    setSchedulingFollowUp(true);
    try {
      await createFollowUp(child.id, topicId, plan?.id ?? null, "review", scheduleDays);
      setSchedulingTopic(null);
      setScheduleDays(7);
    } finally {
      setSchedulingFollowUp(false);
    }
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
      const sources = Array.isArray(parsed.sources) ? parsed.sources : [];

      await saveTopicAlert(child.id, activeTopicId, level, summary, suggestion, sources);
      onAlertChange(activeTopicId, level, summary, suggestion, sources);
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
          if (topic.isActionPlan) {
            return (
              <button
                key={topic.id}
                className={`topic-tab ap-tab ${activeTopicId === topic.id ? "active" : ""}`}
                onClick={() => { setActiveTopicId(topic.id); setNewContent(""); }}
              >
                {topic.label}
                {apBadgeCount > 0 && (
                  <span className="ap-badge">{apBadgeCount}</span>
                )}
                {apBadgeCount === 0 && addressedTopics.length > 0 && (
                  <span className="alert-dot addressed" title="Alla varningar har åtgärdats" />
                )}
              </button>
            );
          }
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
        {activeTopic?.isActionPlan ? (
          // ── Action Plan panel ──
          <div className="ap-panel">
            {alertTopics.length === 0 && addressedTopics.length === 0 ? (
              <div className="ap-empty">
                <CheckCircle size={32} className="ap-empty-icon" />
                <p>Inga aktiva varningar. Alla ämnen ser bra ut.</p>
              </div>
            ) : (
              <>
                {/* Unaddressed alerts first */}
                {alertTopics.map((topic) => {
                  const alert = alerts[topic.id];
                  const draft = planDrafts[topic.id] ?? "";
                  const days = planDays[topic.id] ?? 14;
                  return (
                    <div key={topic.id} className="ap-topic-section">
                      <div className="ap-topic-header">
                        <span className={`alert-dot ${alert.level}`} />
                        <span className="ap-topic-label">{topic.label}</span>
                        {alert.analyzedAt && (
                          <span className="ap-topic-date">
                            Varning sedan {new Date(alert.analyzedAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                      {alert.response && (
                        <p className="ap-alert-summary">{alert.response}</p>
                      )}
                      <button
                        className="ap-toggle-btn"
                        onClick={() => toggleExpanded(topic.id)}
                      >
                        {expandedTopics.has(topic.id) ? "Visa mindre ▴" : "Visa mer ▾"}
                      </button>
                      {expandedTopics.has(topic.id) && (
                        <>
                      {alert.suggestion && (
                        <div className="ap-alert-suggestion">
                          <strong>💡 Förslag på hur man kan gå vidare:</strong>
                          <ul>
                            {alert.suggestion.split(/[\n•]+/).filter(s => s.trim()).map((point, i) => (
                              <li key={i}>{point.trim()}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {alert.sources?.length > 0 && (
                        <div className="ap-alert-sources">
                          <span className="ap-alert-sources-label">Baserat på:</span>
                          {alert.sources.map((idx) => {
                            const note = (notesByTopic[topic.id] ?? [])[idx - 1];
                            if (!note) return null;
                            const excerpt = note.content.length > 120 ? note.content.slice(0, 120) + "…" : note.content;
                            const date = new Date(note.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
                            return (
                              <div key={idx} className="ap-alert-source-item">
                                <span className="source-meta">📝 {date}</span>
                                <span className="source-excerpt">"{excerpt}"</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                        </>
                      )}
                      <div className="ap-form">
                        <label className="ap-form-label">Beskriv åtgärdsplanen</label>
                        <textarea
                          className="ap-textarea"
                          rows={4}
                          placeholder="Vilka åtgärder ska vidtas? Vem ansvarar? Vad följs upp?…"
                          value={draft}
                          onChange={(e) => setPlanDrafts((p) => ({ ...p, [topic.id]: e.target.value }))}
                        />
                        <div className="ap-form-footer">
                          <label className="ap-days-label">
                            Uppföljning om
                            <input
                              type="number"
                              min={1}
                              max={365}
                              className="ap-days-input"
                              value={days}
                              onChange={(e) => setPlanDays((p) => ({ ...p, [topic.id]: Number(e.target.value) }))}
                            />
                            dagar
                          </label>
                          <button
                            className="ap-save-btn"
                            onClick={() => handleSaveActionPlan(topic.id)}
                            disabled={!draft.trim() || savingPlan === topic.id}
                          >
                            {savingPlan === topic.id
                              ? <><Loader size={13} className="spin" /> Sparar…</>
                              : <><CheckCircle size={13} /> Spara åtgärdsplan</>
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Addressed topics */}
                {addressedTopics.map((topic) => {
                  const alert = alerts[topic.id];
                  const plan = actionPlans[topic.id];
                  const draft = planDrafts[topic.id] ?? "";
                  const days = planDays[topic.id] ?? 14;
                  const followUpDate = plan
                    ? new Date(new Date(plan.created_at).getTime() + plan.follow_up_days * 86_400_000)
                        .toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })
                    : null;
                  return (
                    <div key={topic.id} className="ap-topic-section addressed">
                      <div className="ap-topic-header">
                        <span className="alert-dot addressed" />
                        <span className="ap-topic-label">{topic.label}</span>
                        <span className="ap-addressed-badge">Hanterad</span>
                      </div>
                      {alert.response && (
                        <p className="ap-alert-summary">{alert.response}</p>
                      )}
                      <button
                        className="ap-toggle-btn"
                        onClick={() => toggleExpanded(topic.id)}
                      >
                        {expandedTopics.has(topic.id) ? "Visa mindre ▴" : "Visa mer ▾"}
                      </button>
                      {expandedTopics.has(topic.id) && (
                        <>
                      {alert.suggestion && (
                        <div className="ap-alert-suggestion">
                          <strong>💡 Förslag på hur man kan gå vidare:</strong>
                          <ul>
                            {alert.suggestion.split(/[\n•]+/).filter(s => s.trim()).map((point, i) => (
                              <li key={i}>{point.trim()}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {alert.sources?.length > 0 && (
                        <div className="ap-alert-sources">
                          <span className="ap-alert-sources-label">Baserat på:</span>
                          {alert.sources.map((idx) => {
                            const note = (notesByTopic[topic.id] ?? [])[idx - 1];
                            if (!note) return null;
                            const excerpt = note.content.length > 120 ? note.content.slice(0, 120) + "…" : note.content;
                            const date = new Date(note.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
                            return (
                              <div key={idx} className="ap-alert-source-item">
                                <span className="source-meta">📝 {date}</span>
                                <span className="source-excerpt">"{excerpt}"</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                        </>
                      )}
                      {plan && (
                        <div className="ap-existing-plan">
                          <div className="ap-existing-header">
                            <span className="ap-existing-date">
                              Åtgärdsplan skapad {new Date(plan.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            {followUpDate && (
                              <span className="ap-followup-date"><Calendar size={11} /> Uppföljning planerad {followUpDate}</span>
                            )}
                          </div>
                          <p className="ap-existing-content">{plan.content}</p>
                        </div>
                      )}
                      {/* Manual follow-up scheduling */}
                      {schedulingTopic === topic.id ? (
                        <div className="ap-schedule-form">
                          <label className="ap-days-label">
                            Lägg till uppföljning om
                            <input
                              type="number"
                              min={1}
                              max={365}
                              className="ap-days-input"
                              value={scheduleDays}
                              onChange={(e) => setScheduleDays(Number(e.target.value))}
                            />
                            dagar
                          </label>
                          <div className="ap-schedule-actions">
                            <button
                              className="ap-save-btn"
                              onClick={() => handleScheduleFollowUp(topic.id)}
                              disabled={schedulingFollowUp}
                            >
                              {schedulingFollowUp
                                ? <><Loader size={13} className="spin" /> Sparar…</>
                                : <><Calendar size={13} /> Bekräfta</>
                              }
                            </button>
                            <button className="ap-cancel-btn" onClick={() => setSchedulingTopic(null)}>Avbryt</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="ap-schedule-trigger"
                          onClick={() => { setSchedulingTopic(topic.id); setScheduleDays(7); }}
                        >
                          <Calendar size={13} /> Lägg till uppföljningsavisering
                        </button>
                      )}
                      {/* Allow submitting a new/updated action plan */}
                      <div className="ap-form ap-form-update">
                        <label className="ap-form-label">Uppdatera åtgärdsplan (valfritt)</label>
                        <textarea
                          className="ap-textarea"
                          rows={3}
                          placeholder="Skriv en ny åtgärdsplan för att ersätta den befintliga…"
                          value={draft}
                          onChange={(e) => setPlanDrafts((p) => ({ ...p, [topic.id]: e.target.value }))}
                        />
                        {draft.trim() && (
                          <div className="ap-form-footer">
                            <label className="ap-days-label">
                              Uppföljning om
                              <input
                                type="number"
                                min={1}
                                max={365}
                                className="ap-days-input"
                                value={days}
                                onChange={(e) => setPlanDays((p) => ({ ...p, [topic.id]: Number(e.target.value) }))}
                              />
                              dagar
                            </label>
                            <button
                              className="ap-save-btn"
                              onClick={() => handleSaveActionPlan(topic.id)}
                              disabled={savingPlan === topic.id}
                            >
                              {savingPlan === topic.id
                                ? <><Loader size={13} className="spin" /> Sparar…</>
                                : <><CheckCircle size={13} /> Spara ny plan</>
                              }
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ) : (
          <>
        {/* Note composer */}
        <div className="note-composer">
          <div className="composer-label">Ny anteckning — {activeTopic.label}</div>
          <textarea
            ref={textareaRef}
            className={`composer-textarea${isListening ? " listening" : ""}`}
            placeholder="Dokumentera observationer, beteenden, milstolpar…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
          />
          <div className="composer-footer">
            <span className="composer-hint">⌘ + Enter för att spara</span>
            <div className="composer-actions">
              {speechSupported && (
                <button
                  className={`mic-btn${isListening ? " active" : ""}`}
                  onClick={toggleListening}
                  disabled={cleaningUp}
                  title={isListening ? "Stoppa inspelning" : "Diktera anteckning"}
                  type="button"
                >
                  {cleaningUp
                    ? <><Loader size={14} className="spin" /> Bearbetar…</>
                    : isListening
                      ? <><MicOff size={14} /> Stoppa</>
                      : <><Mic size={14} /> Diktera</>
                  }
                </button>
              )}
              <button
                className="composer-submit"
                onClick={handleAddNote}
                disabled={!newContent.trim() || saving}
              >
                {saving ? <Loader size={14} className="spin" /> : <Plus size={14} />}
                Lägg till
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
                {currentAlert.sources?.length > 0 && (
                  <div className="topic-alert-sources">
                    <span className="topic-alert-sources-label">Baserat på:</span>
                    {currentAlert.sources.map((idx) => {
                      const note = activeNotes[idx - 1];
                      if (!note) return null;
                      const excerpt = note.content.length > 120 ? note.content.slice(0, 120) + "…" : note.content;
                      const date = new Date(note.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
                      return (
                        <div key={idx} className="topic-alert-source-item">
                          <span className="source-meta">📝 {date}</span>
                          <span className="source-excerpt">"{excerpt}"</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {currentAlert.suggestion && (
                  <div className="topic-alert-suggestion">
                    <span>💡</span>
                    <div className="topic-alert-suggestion-body">
                      <strong className="topic-alert-suggestion-label">Förslag på hur man kan gå vidare:</strong>
                      <ul>
                        {currentAlert.suggestion.split(/[\n•]+/).filter(s => s.trim()).map((point, i) => (
                          <li key={i}>{point.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <span className="topic-analyze-hint">Kör en analys för att utvärdera detta ämne</span>
          )}
          <button
            className="topic-analyze-btn"
            onClick={handleAnalyze}
            disabled={analyzing !== null || !aiSettings}
            title={!aiSettings ? "Configure AI in Settings first" : ""}
          >
            {analyzing === activeTopicId ? (
              <><Loader size={13} className="spin" /> Analyserar…</>
            ) : (
              <><RefreshCw size={13} /> Analysera</>
            )}
          </button>
        </div>

        {/* Notes list */}
        {activeNotes.length === 0 ? (
          <div className="notes-empty">
            <div className="notes-empty-icon">📝</div>
            <p>Inga anteckningar ännu för {activeTopic.label}. Börja dokumentera ovan.</p>
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
          </>
        )}
      </div>
    </div>
  );
}
