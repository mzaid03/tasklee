# Security Notes (What to do / what to avoid)

## 1) Anon key vs Service Role key
Supabase provides multiple API keys:

- **Anon (public) key**
  - Intended for browser/client usage
  - Safe to expose in a frontend app
  - Permissions are still enforced by **RLS policies**

- **Service role key**
  - Full admin privileges (bypasses RLS)
  - Must only be used on a trusted server (never in the browser)
  - Must never be committed to GitHub

This project only uses the **anon key** via `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 2) Why Row Level Security (RLS) matters
Even if the UI filters tasks by `user_id`, a malicious user could:
- Modify requests in the browser
- Remove filters
- Try to query other users’ rows

RLS blocks this on the database side.

The policies in `supabase/schema.sql` ensure:
- Select/Insert/Update/Delete only where `user_id = auth.uid()`

## 3) Environment variables
- `.env.local` is used for local development and is ignored by git (`.gitignore` ignores `.env*`)
- Vercel environment variables are configured in the Vercel dashboard

Never commit:
- `SUPABASE_SERVICE_ROLE_KEY`
- Any `.env.*` file containing secrets

## 4) Data separation: guest accounts
Anonymous auth creates a real Supabase user (UUID) with a JWT session.
That user id becomes `auth.uid()` in Postgres, which is what the RLS policies use.

Result:
- User A sees only A’s tasks
- User B sees only B’s tasks
