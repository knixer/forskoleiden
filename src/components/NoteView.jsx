import { useState, useEffect } from "react";
import { Bot, Loader, Menu, BellOff, Clock, AlertTriangle, FlaskConical } from "lucide-react";
import { fetchNotes, fetchTopicAlerts, fetchPendingFollowUps, completeFollowUp } from "../lib/db";
import { TOPICS } from "../lib/topics";
import TopicPanel from "./TopicPanel";
import AIPanel from "./AIPanel";

export default function NoteView({ child, aiSettings, onMenuClick, onAlertChange }) {
  const [notesByTopic, setNotesByTopic] = useState({});
  const [topicAlerts, setTopicAlerts] = useState({});
  const [followUps, setFollowUps] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [child.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [allNotes, alerts] = await Promise.all([
        fetchNotes(child.id),
        fetchTopicAlerts(child.id),
      ]);
      // Group notes by topic_id; fall back to topic_1 for legacy rows
      const grouped = Object.fromEntries(TOPICS.map((t) => [t.id, []]));
      for (const note of allNotes) {
        const key = note.topic_id ?? "topic_1";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(note);
      }
      setNotesByTopic(grouped);
      setTopicAlerts(alerts);
    } finally {
      setLoading(false);
    }
    // Follow-ups load separately — fail silently if table not yet migrated
    const pending = await fetchPendingFollowUps(child.id);
    setFollowUps(pending);
  }

  async function handleCompleteFollowUp(id) {
    if (previewing) {
      setFollowUps((prev) => prev.filter((fu) => fu.id !== id));
      return;
    }
    await completeFollowUp(id);
    setFollowUps((prev) => prev.filter((fu) => fu.id !== id));
  }

  function handleTogglePreview() {
    if (previewing) {
      setPreviewing(false);
      fetchPendingFollowUps(child.id).then(setFollowUps).catch(() => {});
    } else {
      setPreviewing(true);
      setFollowUps([
        {
          id: "preview-1",
          child_id: child.id,
          topic_id: "topic_1",
          type: "unaddressed",
          due_date: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 2 days overdue
        },
        {
          id: "preview-2",
          child_id: child.id,
          topic_id: "topic_2",
          type: "review",
          due_date: new Date(Date.now() + 4 * 86_400_000).toISOString(), // due in 4 days
        },
      ]);
    }
  }

  function handleNotesChange(topicId, newNotes) {
    setNotesByTopic((prev) => ({ ...prev, [topicId]: newNotes }));
  }

  function handleAlertChange(topicId, level, response, suggestion, sources) {
    setTopicAlerts((prev) => ({ ...prev, [topicId]: { level, response, suggestion, sources } }));
    onAlertChange?.(child.id, topicId, level);
  }

  const totalNotes = Object.values(notesByTopic).reduce((sum, arr) => sum + arr.length, 0);
  const allNotes = Object.values(notesByTopic).flat();

  // Helper: is the follow-up overdue?
  const isOverdue = (dateStr) => new Date(dateStr) <= new Date();

  // Label lookup for follow-up banners
  const topicLabel = (topicId) => TOPICS.find((t) => t.id === topicId)?.label ?? topicId;

  if (loading) {
    return (
      <div className="note-view">
        <div className="notes-loading"><Loader size={20} className="spin" /></div>
      </div>
    );
  }

  return (
    <div className="note-view">
      {/* Header */}
      <div className="note-view-header">
        <div className="note-view-title-row">
          <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <div className="child-header-avatar">{child.name[0].toUpperCase()}</div>
          <h1 className="note-view-title">{child.name}</h1>
          <div className="note-count-badge">{totalNotes} anteckning{totalNotes !== 1 ? "ar" : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={`ai-toggle-btn ${previewing ? "active" : ""}`}
            onClick={handleTogglePreview}
            title="Förhandsgranska aviseringar"
          >
            <FlaskConical size={16} />
            {previewing ? "Dölj förhandsgranskning" : "Förhandsgranska"}
          </button>
          <button
            className={`ai-toggle-btn ${showAI ? "active" : ""}`}
            onClick={() => setShowAI((v) => !v)}
          >
            <Bot size={16} />
            {showAI ? "Dölj AI" : "Fråga AI"}
          </button>
        </div>
      </div>

      <div className="note-view-body">
        {/* Follow-up notification banners */}
        {followUps.length > 0 && (
          <div className="followup-banners">
            {followUps.map((fu) => {
              const overdue = isOverdue(fu.due_date);
              const dueLabel = new Date(fu.due_date).toLocaleDateString("sv-SE", {
                day: "numeric", month: "short", year: "numeric",
              });
              return (
                <div key={fu.id} className={`followup-banner ${fu.type}${overdue ? " overdue" : ""}`}>
                  <div className="followup-banner-icon">
                    {fu.type === "unaddressed" ? <AlertTriangle size={15} /> : <Clock size={15} />}
                  </div>
                  <div className="followup-banner-body">
                    <strong className="followup-banner-topic">{topicLabel(fu.topic_id)}</strong>
                    <span className="followup-banner-desc">
                      {fu.type === "unaddressed"
                        ? "Ingen åtgärdsplan har lämnats in för denna varning."
                        : "Åtgärdsplan – dags för uppföljning och utvärdering."
                      }
                    </span>
                    <span className="followup-banner-date">
                      {overdue ? "⚠️ Försenad sedan" : "Uppföljning"}: {dueLabel}
                    </span>
                  </div>
                  <button
                    className="followup-banner-done"
                    onClick={() => handleCompleteFollowUp(fu.id)}
                    title="Markera som klar"
                  >
                    <BellOff size={14} /> Klar
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <TopicPanel
          child={child}
          notesByTopic={notesByTopic}
          alerts={topicAlerts}
          aiSettings={aiSettings}
          onNotesChange={handleNotesChange}
          onAlertChange={handleAlertChange}
        />
        {showAI && (
          <AIPanel
            child={child}
            notes={allNotes}
            aiSettings={aiSettings}
          />
        )}
      </div>
    </div>
  );
}

