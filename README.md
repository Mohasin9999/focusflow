# FocusFlow

FocusFlow is an AI-powered productivity dashboard for planning focused work, tracking study habits, reviewing sleep and distraction patterns, and getting short coaching feedback from an AI productivity coach.

The app combines a React/Vite frontend, a Flask API backend, and Supabase for authentication, database storage, and study-material file storage.

## Features

- Account-based dashboard with Supabase authentication
- Focus timer with session naming, distraction tracking, and saved session history
- Activity log for focus, study, and sleep records
- AI productivity coach with saved chat history
- AI session summaries after completed focus blocks
- Daily and weekly focus/study/sleep/distraction reporting
- Study materials upload, folder organization, and in-session reader
- Supabase schema with row-level security policies

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Lucide React
- Backend: Flask, Flask-CORS, Flask-Limiter, Requests
- Database/Auth/Storage: Supabase
- AI Provider: OpenRouter-compatible chat completions API
- Tests: Vitest, Testing Library

## Project Structure

```text
focusflow/
  backend/              Flask API for AI coach and session reports
  frontend/             React/Vite application
  supabase/schema.sql   Supabase tables, policies, triggers, and storage setup
  README.md
```

## Prerequisites

- Node.js 20 or newer
- Python 3.9 or newer
- A Supabase project
- An OpenRouter API key or compatible chat-completions API key

## Supabase Setup

1. Open your Supabase project.
2. Go to the SQL editor.
3. Run the full contents of `supabase/schema.sql`.
4. Confirm the `study-materials` storage bucket exists.

The schema creates profiles, user settings, logs, AI coach messages, study material tables, row-level security policies, and storage policies.

## Environment Variables

Create `frontend/.env.local` with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Create `backend/.env` or use exported environment variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=google/gemini-2.5-flash
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_APP_NAME=FocusFlow
ALLOWED_ORIGINS=http://localhost:5173
PORT=5001
```

The backend also loads `frontend/.env.local`, so local Supabase variables can be shared during development.

## Installation

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install backend dependencies:

```bash
python3 -m venv venv
./venv/bin/pip install -r backend/requirements.txt
```

If your virtual environment is already at the project root, keep using `./venv/bin/python backend/app.py`.

## Running Locally

Start the Flask backend from the project root:

```bash
./venv/bin/python backend/app.py
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Testing

Run frontend tests:

```bash
cd frontend
npm test
```

Run frontend linting:

```bash
cd frontend
npm run lint
```

Check backend syntax:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/focusflow-pycache python3 -m py_compile backend/app.py
```

## Notes

- Focus-session totals are calculated from saved logs using the user's local-day timestamp method.
- The AI coach receives exact daily and weekly values from the app before writing responses.
- The app should be used with authenticated Supabase users so row-level security can protect user data.
