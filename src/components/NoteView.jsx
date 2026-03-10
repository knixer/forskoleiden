import { useState, useEffect } from "react";
import { Bot, Loader, Menu } from "lucide-react";
import { fetchNotes, fetchTopicAlerts } from "../lib/db";
import { TOPICS } from "../lib/topics";
import TopicPanel from "./TopicPanel";
import AIPanel from "./AIPanel";

export default function NoteView({ child, aiSettings, onMenuClick, onAlertChange }) {
  const [notesByTopic, setNotesByTopic] = useState({});
  const [topicAlerts, setTopicAlerts] = useState({});
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
        <button
          className={`ai-toggle-btn ${showAI ? "active" : ""}`}
          onClick={() => setShowAI((v) => !v)}
        >
          <Bot size={16} />
          {showAI ? "Dölj AI" : "Fråga AI"}
        </button>
      </div>

      <div className="note-view-body">
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

