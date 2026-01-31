# Task Manager (Supabase Guest Auth)

Simple task manager built with Next.js (TypeScript) + Supabase.

Features:
- Anonymous “guest accounts” (Supabase Auth) created automatically on first launch
- Tasks are stored with a `user_id` and protected via Row Level Security (RLS)
- View tasks, create tasks, and toggle complete/incomplete
- Loading + error states
- Optional fields supported: description, priority, due date

## Prerequisites

- Node.js installed
- A Supabase project (Free Tier)

## 1) Create the database + RLS policies

1. In Supabase, open **SQL Editor**
2. Run the SQL in [supabase/schema.sql](supabase/schema.sql)

That creates the `public.tasks` table and enables RLS policies so each user can only read/write their own rows.

## 2) Enable anonymous sign-in

In Supabase:
- **Authentication → Providers → Anonymous**: enable anonymous sign-ins

## 3) Configure environment variables

1. Copy `.env.example` to `.env.local`
2. Fill in values from **Supabase Project Settings → API**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Important:
- Do **not** use the service role key in the frontend
- Do **not** commit `.env.local`

## 4) Run locally

Windows note: if PowerShell blocks `npm`, use `npm.cmd`.

```bash
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000

## 5) Deploy to Vercel

High-level:
1. Push this repo to GitHub
2. Import it in Vercel
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel project env vars
4. Deploy

## Security notes

- The frontend only uses the Supabase **anon** key (safe to expose).
- RLS policies in Supabase enforce per-user access; the client cannot bypass them.
- Never commit secrets (service role key, private env vars) to GitHub.
