# FluSec Web Platform

> **Collaborative Flutter Security Intelligence Hub** — aggregate, track, and fix security vulnerabilities across your engineering team in real time.

## Overview

FluSec is a monorepo connecting the **FluSec VS Code Extension** to a **team web dashboard**. Developers scan their Flutter projects locally and sync findings to a shared platform where team leaders can monitor risk, assign fixes, and track progress.

```
VS Code Extension  →  (sync findings)  →  Backend API  →  Supabase DB  →  Web Dashboard
```

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Charts | Recharts |
| State | Zustand |

## Project Structure

```
flusec-webapp/
├── frontend/               # React web app (Vite)
├── backend/                # Express API server
├── supabase_schema.sql     # Run this in Supabase SQL Editor first
└── supabase_rls_fix.sql    # RLS policy fixes (run after schema)
```

## Getting Started

### 1. Prerequisites
- Node.js v18+
- A [Supabase](https://supabase.com) project

### 2. Database Setup
1. Open Supabase → **SQL Editor**
2. Run `supabase_schema.sql`
3. Run `supabase_rls_fix.sql`
4. Create a private **Storage bucket** named `findings`

### 3. Environment Variables

**`backend/.env`**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
PORT=3001
FRONTEND_URL=http://localhost:5173
```

**`frontend/.env`**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Install & Run

```bash
# Backend (terminal 1)
cd backend && npm install && npm run dev

# Frontend (terminal 2)
cd frontend && npm install && npm run dev
```

App runs at **http://localhost:5173**

## Features (Phase 1 ✅)

- Email authentication (Supabase Auth)
- Create / Join teams with invite codes
- Member Dashboard — personal findings, severity charts
- Team Detail — member comparison, risk scores, critical findings list
- VS Code Extension sync (`FluSec: Login` + `FluSec: Sync Findings to Team`)

## VS Code Extension

1. In VS Code Settings JSON add: `"flusec.webApiEndpoint": "http://localhost:3001"`
2. Press `F5` to run the extension
3. `Ctrl+Shift+P` → **FluSec: Login to Team**
4. After scanning → **FluSec: Sync Findings to Team**

## Roadmap

- [ ] Task assignment system
- [ ] Email notifications (Resend)
- [ ] Ollama LLM guidance per finding
- [ ] PDF security reports

## License

MIT — FluSec Research Team 2026
