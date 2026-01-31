# Task Manager Assessment – Final Deliverable

> Rename/export as: `firstname_lastname_task_manager_assessment.pdf` (or `.docx`)

## Overview
- Built a simple task manager with a Next.js (TypeScript) web frontend.
- Uses Supabase (Free Tier) for database + anonymous auth “guest accounts”.
- Row Level Security (RLS) ensures each guest only sees their own tasks.

## Live Demo
- Live URL: <ADD_VERCEL_URL_HERE>

## GitHub Repository
- Repo URL: <ADD_GITHUB_REPO_URL_HERE>

## Supabase Project
- Project URL (or dashboard link): <ADD_SUPABASE_PROJECT_URL_HERE>
- Table: `public.tasks`

## Local Setup
1. Install deps:
   - `npm.cmd install`
2. Create `.env.local` from `.env.example` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. In Supabase SQL Editor, run:
   - `supabase/schema.sql`
4. Start dev server:
   - `npm.cmd run dev`
5. Open:
   - `http://localhost:3000`

## Database Schema
- See `supabase/schema.sql` (table + RLS policies)

## Tradeoffs / Improvements
- Add optimistic UI updates + better offline handling.
- Add pagination or infinite scroll for large task lists.
- Add delete task + edit task.
- Add filtering/sorting (complete/incomplete, priority, due date).
- Add end-to-end tests and CI.

## Security Notes
- Frontend uses only the public Supabase anon key.
- RLS is enabled on `tasks` to prevent cross-user access.
- No service role key is stored in the client or committed to GitHub.
