// src/lib/db.js
// Data layer  all persistence via Supabase.

import { supabase } from "./supabase";

function raise(error) {
  if (error) throw new Error(error.message);
}

//  Children 

export async function fetchChildren() {
  const { data, error } = await supabase
    .from("children")
    .select("*")
    .order("name", { ascending: true });
  raise(error);
  return data;
}

export async function addChild(name) {
  const { data, error } = await supabase
    .from("children")
    .insert({ name })
    .select("id")
    .single();
  raise(error);
  return data.id;
}

export async function deleteChild(id) {
  const { error } = await supabase.from("children").delete().eq("id", id);
  raise(error);
}

//  Notes 

export async function fetchNotes(childId) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  raise(error);
  return data;
}

export async function addNote(childId, topicId, content) {
  const { data, error } = await supabase
    .from("notes")
    .insert({ child_id: childId, topic_id: topicId, content })
    .select("id")
    .single();
  raise(error);
  return data.id;
}

export async function updateNote(id, content) {
  const { error } = await supabase
    .from("notes")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id);
  raise(error);
}

export async function deleteNote(id) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  raise(error);
}

//  Topic Alerts 

export async function fetchTopicAlerts(childId) {
  const { data, error } = await supabase
    .from("topic_alerts")
    .select("topic_id, alert_level, response, suggestion, analyzed_at")
    .eq("child_id", childId);
  if (error) return {}; // table may not exist yet — fail silently
  const map = {};
  for (const row of data) {
    map[row.topic_id] = { level: row.alert_level, response: row.response, suggestion: row.suggestion, analyzedAt: row.analyzed_at };
  }
  return map;
}

export async function saveTopicAlert(childId, topicId, alertLevel, response, suggestion) {
  const { error } = await supabase
    .from("topic_alerts")
    .upsert(
      { child_id: childId, topic_id: topicId, alert_level: alertLevel, response, suggestion, analyzed_at: new Date().toISOString() },
      { onConflict: "child_id,topic_id" }
    );
  raise(error);
}

// Returns { childId: { topicId: level } } — used by App to show worst alert per child in sidebar.
export async function fetchAllChildAlerts() {
  const { data, error } = await supabase
    .from("topic_alerts")
    .select("child_id, topic_id, alert_level");
  raise(error);
  const result = {};
  for (const row of data) {
    if (!result[row.child_id]) result[row.child_id] = {};
    result[row.child_id][row.topic_id] = row.alert_level;
  }
  return result;
}

//  AI Summaries 

export async function saveAiSummary(childId, prompt, response) {
  const { error } = await supabase
    .from("ai_summaries")
    .insert({ child_id: childId, prompt, response });
  raise(error);
}

//  AI Settings 

const DEFAULT_AI_SETTINGS = {
  id: 1,
  provider: "claude",
  claude_api_key: "",
  claude_model: "claude-sonnet-4-20250514",
  ollama_base_url: "http://localhost:11434",
  ollama_model: "llama3",
  system_prompt: "You are a helpful assistant reviewing child care documentation. Be concise and insightful.",
};

export async function fetchAiSettings() {
  const { data, error } = await supabase
    .from("ai_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return DEFAULT_AI_SETTINGS;
  return data;
}

export async function saveAiSettings(settings) {
  const { error } = await supabase
    .from("ai_settings")
    .upsert({ ...settings, id: 1 });
  raise(error);
}
