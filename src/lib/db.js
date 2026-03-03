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

export async function addNote(childId, content) {
  const { data, error } = await supabase
    .from("notes")
    .insert({ child_id: childId, content })
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
