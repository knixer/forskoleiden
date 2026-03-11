# CareDoc

A web-based documentation tool for kindergarten staff to observe, document, and follow up on children's development. Built with **React + Vite + Supabase**, with AI-powered analysis via **Anthropic Claude** or **Ollama** (local models).

---

## Features

- **Child list** — sidebar with all children; add/remove in one click
- **Topic-based notes** — three fixed observation areas per child:
  - *Daganteckningar* — daily observations and peer interactions
  - *Normer och värden* — emotional regulation and wellbeing
  - *Utveckling och lärande* — physical development and health
- **Voice dictation** — dictate notes via the browser's Speech Recognition API (Swedish); AI cleans up the transcript automatically
- **AI analysis** — run a per-topic analysis that returns a structured result:
  - **Alert level**: `ok` / `yellow` / `red`
  - **Summary** in Swedish
  - **Suggestions** for next steps (bullet points)
  - **Source references** — which specific notes the assessment is based on
- **Action plans** — a dedicated *Åtgärdsplan* tab appears when a yellow or red alert exists. Staff can:
  - Read the full AI analysis (summary, suggestions, source notes)
  - Submit an action plan to mark the issue as addressed
  - Set a follow-up date (configurable number of days)
  - Schedule additional follow-up reminders on demand
- **Follow-up notifications** — banners appear when a follow-up is due:
  - *Unaddressed*: no action plan submitted after 7 days
  - *Review*: scheduled review date for a submitted action plan
  - Overdue notifications are highlighted in red
- **Free-text AI chat** — ask open questions about a child's full documentation across all topics
- **Settings** — configure AI provider, model, API key, and system prompt

---

## Tech Stack

| Layer      | Technology                     |
|------------|-------------------------------|
| Frontend   | React 18, Vite                 |
| Database   | Supabase (PostgreSQL)          |
| AI (cloud) | Anthropic Claude API           |
| AI (local) | Ollama HTTP API                |
| Styling    | Pure CSS (no Tailwind)         |
| Icons      | lucide-react                   |

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- A [Supabase](https://supabase.com) project

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file in the project root
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional — bake in an Anthropic key so users don't need to configure it
VITE_ANTHROPIC_API_KEY=sk-ant-...

# 3. Run the database migrations (see Database Schema below)

# 4. Start the dev server
npm run dev

# 5. Build for production
npm run build
```

---

## Project Structure

```
src/
├── main.jsx                  # React entry point
├── App.jsx                   # Root — child list, alert state, routing
├── styles/
│   └── app.css               # Design system & all styles
├── lib/
│   ├── supabase.js           # Supabase client initialisation
│   ├── db.js                 # All database access functions
│   ├── ai.js                 # Claude + Ollama AI service
│   └── topics.js             # Topic definitions & AI prompts
└── components/
    ├── Sidebar.jsx           # Left nav — child list + add/delete
    ├── NoteView.jsx          # Main view — notes, follow-up banners
    ├── TopicPanel.jsx        # Tabbed topics + action plan tab
    ├── NoteCard.jsx          # Individual note with edit/delete
    ├── AIPanel.jsx           # Free-text AI chat panel
    └── SettingsModal.jsx     # AI provider configuration
```

---

## Database Schema

Run the following SQL in your Supabase SQL editor to set up all required tables.

```sql
-- Children
CREATE TABLE children (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes (per topic)
CREATE TABLE notes (
  id         SERIAL PRIMARY KEY,
  child_id   UUID REFERENCES children(id) ON DELETE CASCADE,
  topic_id   TEXT,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI topic analysis results
CREATE TABLE topic_alerts (
  id             SERIAL PRIMARY KEY,
  child_id       UUID REFERENCES children(id) ON DELETE CASCADE,
  topic_id       TEXT NOT NULL,
  alert_level    TEXT NOT NULL,          -- 'ok' | 'yellow' | 'red'
  response       TEXT,
  suggestion     TEXT,
  sources        TEXT,                   -- JSON array of note indices
  analyzed_at    TIMESTAMPTZ DEFAULT NOW(),
  action_plan_id INT,                    -- set when an action plan is submitted
  UNIQUE (child_id, topic_id)
);

-- Action plans (submitted in response to a yellow/red alert)
CREATE TABLE action_plans (
  id             SERIAL PRIMARY KEY,
  child_id       UUID REFERENCES children(id) ON DELETE CASCADE,
  topic_id       TEXT NOT NULL,
  content        TEXT NOT NULL,
  follow_up_days INT NOT NULL DEFAULT 14,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- FK from topic_alerts to action_plans
ALTER TABLE topic_alerts
  ADD CONSTRAINT fk_action_plan
  FOREIGN KEY (action_plan_id) REFERENCES action_plans(id) ON DELETE SET NULL;

-- Follow-up notifications
CREATE TABLE follow_up_notifications (
  id             SERIAL PRIMARY KEY,
  child_id       UUID REFERENCES children(id) ON DELETE CASCADE,
  topic_id       TEXT NOT NULL,
  action_plan_id INT REFERENCES action_plans(id) ON DELETE SET NULL,
  type           TEXT NOT NULL,          -- 'unaddressed' | 'review'
  due_date       TIMESTAMPTZ NOT NULL,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- AI conversation history
CREATE TABLE ai_summaries (
  id         SERIAL PRIMARY KEY,
  child_id   UUID REFERENCES children(id) ON DELETE CASCADE,
  prompt     TEXT,
  response   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI settings (single row)
CREATE TABLE ai_settings (
  id               INT PRIMARY KEY DEFAULT 1,
  provider         TEXT DEFAULT 'claude',
  claude_api_key   TEXT DEFAULT '',
  claude_model     TEXT DEFAULT 'claude-sonnet-4-20250514',
  ollama_base_url  TEXT DEFAULT 'http://localhost:11434',
  ollama_model     TEXT DEFAULT 'llama3',
  system_prompt    TEXT DEFAULT 'You are a helpful assistant reviewing child care documentation. Be concise and insightful.'
);
```

---

## AI Integration

### Claude (Anthropic)

1. Open **Settings** (gear icon in the sidebar)
2. Set **Provider** → Claude
3. Paste your **Anthropic API key** (from [console.anthropic.com](https://console.anthropic.com))
4. Choose a model (e.g. `claude-sonnet-4-20250514`)

Alternatively, set `VITE_ANTHROPIC_API_KEY` in your `.env` file to apply a key for all users without manual configuration.

### Ollama (Local / Offline)

1. [Install Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3`
3. In **Settings** → Provider → **Ollama**
4. Set Base URL (default: `http://localhost:11434`)
5. Set Model name (e.g. `llama3`, `mistral`)

---

## Adding or Editing Topics

Topics are defined in `src/lib/topics.js`. Each topic has:

- `id` — unique string key stored in the database
- `label` — display name shown in the tab
- `prompt` — the full system prompt sent to the AI for analysis

To add a new topic, append a new object to the `TOPICS` array. No database changes are needed — `topic_id` is stored as free text.

---

## Future Backend Migration

The entire database layer is isolated in `src/lib/db.js`. All components interact only with the functions exported from that file — none reference Supabase directly. When migrating to a custom backend (e.g. AWS RDS + Express), only `db.js` and `supabase.js` need to change. The database schema maps directly to standard PostgreSQL with no Supabase-specific features required (Row Level Security is not used).

---

## License

MIT
