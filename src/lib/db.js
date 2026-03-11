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
    .select("topic_id, alert_level, response, suggestion, sources, analyzed_at, action_plan_id")
    .eq("child_id", childId);
  if (error) return {}; // table may not exist yet — fail silently
  const map = {};
  for (const row of data) {
    // If the alert has an action plan, treat it as "addressed" visually
    const effectiveLevel = (row.alert_level !== "ok" && row.action_plan_id)
      ? "addressed"
      : row.alert_level;
    map[row.topic_id] = {
      level: effectiveLevel,
      rawLevel: row.alert_level,
      response: row.response,
      suggestion: row.suggestion,
      sources: row.sources ? JSON.parse(row.sources) : [],
      analyzedAt: row.analyzed_at,
      actionPlanId: row.action_plan_id,
    };
  }
  return map;
}

export async function saveTopicAlert(childId, topicId, alertLevel, response, suggestion, sources) {
  const { error } = await supabase
    .from("topic_alerts")
    .upsert(
      {
        child_id: childId,
        topic_id: topicId,
        alert_level: alertLevel,
        response,
        suggestion,
        sources: sources?.length ? JSON.stringify(sources) : null,
        analyzed_at: new Date().toISOString(),
        action_plan_id: null, // re-analysis always resets the addressed state
      },
      { onConflict: "child_id,topic_id" }
    );
  raise(error);

  // Auto-schedule an "unaddressed" follow-up 7 days out for red/yellow alerts.
  // Fails silently if the follow_up_notifications table hasn't been migrated yet.
  if (alertLevel === "red" || alertLevel === "yellow") {
    try {
      // Cancel any existing pending unaddressed follow-ups for this topic
      await supabase
        .from("follow_up_notifications")
        .update({ completed_at: new Date().toISOString() })
        .eq("child_id", childId)
        .eq("topic_id", topicId)
        .eq("type", "unaddressed")
        .is("completed_at", null);

      const dueDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
      await supabase
        .from("follow_up_notifications")
        .insert({ child_id: childId, topic_id: topicId, type: "unaddressed", due_date: dueDate });
    } catch {
      // Migration not yet run — fail silently
    }
  }
}

// Returns { childId: { topicId: level } } — used by App to show worst alert per child in sidebar.
// Topics with an action_plan_id are considered "addressed" and don't count as active warnings.
export async function fetchAllChildAlerts() {
  const { data, error } = await supabase
    .from("topic_alerts")
    .select("child_id, topic_id, alert_level, action_plan_id");
  raise(error);
  const result = {};
  for (const row of data) {
    if (!result[row.child_id]) result[row.child_id] = {};
    const level = (row.alert_level !== "ok" && row.action_plan_id) ? "addressed" : row.alert_level;
    result[row.child_id][row.topic_id] = level;
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

// ── Action Plans ─────────────────────────────────────────────────────────────

// Returns the most recent action plan per topic: { topic_id: plan }
export async function fetchActionPlans(childId) {
  const { data, error } = await supabase
    .from("action_plans")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  raise(error);
  const map = {};
  for (const row of data) {
    if (!map[row.topic_id]) map[row.topic_id] = row; // keep only latest per topic
  }
  return map;
}

export async function saveActionPlan(childId, topicId, content, followUpDays = 14) {
  // Insert the action plan
  const { data: plan, error: e1 } = await supabase
    .from("action_plans")
    .insert({ child_id: childId, topic_id: topicId, content, follow_up_days: followUpDays })
    .select("id")
    .single();
  raise(e1);

  // Link the action plan to the topic alert → marks it "addressed"
  const { error: e2 } = await supabase
    .from("topic_alerts")
    .update({ action_plan_id: plan.id })
    .eq("child_id", childId)
    .eq("topic_id", topicId);
  raise(e2);

  // Cancel pending "unaddressed" follow-ups for this topic
  await supabase
    .from("follow_up_notifications")
    .update({ completed_at: new Date().toISOString() })
    .eq("child_id", childId)
    .eq("topic_id", topicId)
    .eq("type", "unaddressed")
    .is("completed_at", null);

  // Schedule a "review" follow-up
  const dueDate = new Date(Date.now() + followUpDays * 86_400_000).toISOString();
  const { error: e3 } = await supabase
    .from("follow_up_notifications")
    .insert({ child_id: childId, topic_id: topicId, action_plan_id: plan.id, type: "review", due_date: dueDate });
  raise(e3);

  return plan.id;
}

// ── Follow-up Notifications ───────────────────────────────────────────────────

export async function fetchPendingFollowUps(childId) {
  const { data, error } = await supabase
    .from("follow_up_notifications")
    .select("*")
    .eq("child_id", childId)
    .is("completed_at", null)
    .order("due_date", { ascending: true });
  if (error) return []; // table may not exist yet — fail silently
  return data;
}

// Manually trigger a follow-up notification due in `dueDays` days.
export async function createFollowUp(childId, topicId, actionPlanId, type, dueDays) {
  const dueDate = new Date(Date.now() + dueDays * 86_400_000).toISOString();
  const { error } = await supabase
    .from("follow_up_notifications")
    .insert({ child_id: childId, topic_id: topicId, action_plan_id: actionPlanId ?? null, type, due_date: dueDate });
  raise(error);
}

export async function completeFollowUp(id) {
  const { error } = await supabase
    .from("follow_up_notifications")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id);
  raise(error);
}
