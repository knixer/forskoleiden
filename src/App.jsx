import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import NoteView from "./components/NoteView";
import SettingsModal from "./components/SettingsModal";
import { fetchChildren, addChild, deleteChild, fetchAiSettings, fetchAllChildAlerts } from "./lib/db";
import "./styles/app.css";

export default function App() {
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // childTopicAlerts: { childId: { topicId: alertLevel } }
  const [childTopicAlerts, setChildTopicAlerts] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [kids, settings] = await Promise.all([fetchChildren(), fetchAiSettings()]);
      setChildren(kids);
      setAiSettings(settings);
      if (kids.length > 0) setSelectedChild(kids[0]);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
    // Load topic alerts separately — table may not exist yet if migration hasn't run
    try {
      const topicAlerts = await fetchAllChildAlerts();
      setChildTopicAlerts(topicAlerts);
    } catch (e) {
      console.warn("topic_alerts table not found — run the SQL migration in Supabase:", e.message);
    }
  }

  // Called by NoteView when a topic analysis produces a new alert level.
  function handleAlertChange(childId, topicId, level) {
    setChildTopicAlerts((prev) => ({
      ...prev,
      [childId]: { ...(prev[childId] ?? {}), [topicId]: level },
    }));
  }

  // Derive the worst alert level per child across all their topics.
  const LEVEL_RANK = { ok: 0, yellow: 1, red: 2 };
  const childAlerts = {};
  for (const [childId, topics] of Object.entries(childTopicAlerts)) {
    let worst = "ok";
    for (const lvl of Object.values(topics)) {
      if ((LEVEL_RANK[lvl] ?? 0) > (LEVEL_RANK[worst] ?? 0)) worst = lvl;
    }
    if (worst !== "ok") childAlerts[childId] = worst;
  }

  async function handleAddChild(name) {
    const id = await addChild(name);
    const newChild = { id, name, created_at: new Date().toISOString() };
    setChildren((prev) => [...prev, newChild].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedChild(newChild);
    setSidebarOpen(false);
  }

  async function handleDeleteChild(child) {
    if (!confirm(`Remove ${child.name} and all their notes?`)) return;
    await deleteChild(child.id);
    setChildren((prev) => prev.filter((c) => c.id !== child.id));
    if (selectedChild?.id === child.id) {
      setSelectedChild(children.find((c) => c.id !== child.id) ?? null);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Loading CareDoc…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        children={children}
        selected={selectedChild}
        onSelect={(child) => { setSelectedChild(child); setSidebarOpen(false); }}
        onAdd={handleAddChild}
        onDelete={handleDeleteChild}
        onOpenSettings={() => setShowSettings(true)}
        isOpen={sidebarOpen}
        childAlerts={childAlerts}
      />

      <main className="main-content">
        {selectedChild ? (
          <NoteView
            child={selectedChild}
            aiSettings={aiSettings}
            onMenuClick={() => setSidebarOpen(true)}
            onAlertChange={handleAlertChange}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>No child selected</h2>
            <p>Add a child in the sidebar to start documenting.</p>
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsModal
          initial={aiSettings}
          onSave={(s) => { setAiSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
