-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ai_settings (
  id integer NOT NULL DEFAULT 1,
  provider text NOT NULL DEFAULT 'claude'::text,
  claude_api_key text DEFAULT ''::text,
  claude_model text DEFAULT 'claude-sonnet-4-20250514'::text,
  ollama_base_url text DEFAULT 'http://localhost:11434'::text,
  ollama_model text DEFAULT 'llama3'::text,
  system_prompt text DEFAULT 'You are a helpful assistant reviewing child care documentation. Be concise and insightful.'::text,
  CONSTRAINT ai_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ai_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  prompt text NOT NULL,
  response text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT ai_summaries_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.children(id)
);
CREATE TABLE public.children (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT children_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  topic_id text NOT NULL DEFAULT 'topic_1'::text,
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.children(id)
);
CREATE TABLE public.topic_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL,
  topic_id text NOT NULL,
  alert_level text NOT NULL DEFAULT 'ok'::text,
  response text,
  analyzed_at timestamp with time zone NOT NULL DEFAULT now(),
  suggestion text,
  sources text,
  CONSTRAINT topic_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT topic_alerts_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.children(id)
);