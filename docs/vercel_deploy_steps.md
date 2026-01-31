# Deploying to Vercel (Step-by-step)

## Prereqs
- A GitHub repo containing this project
- A Supabase project with the schema applied

## 1) Push to GitHub
1. Create a new GitHub repository (public or private)
2. From the project root, initialize git and push

## 2) Import into Vercel
1. Go to Vercel dashboard → **Add New… → Project**
2. Select your GitHub repo
3. Framework should auto-detect as **Next.js**

## 3) Configure Environment Variables
In Vercel → Project → **Settings → Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Add them for **Production**, and optionally **Preview** and **Development**.

## 4) Deploy
1. Click **Deploy**
2. After the build completes, open the provided URL

## 5) Verify
- Open the deployed site
- Create a few tasks
- Refresh the page: tasks persist
- Click **New guest**: you should see an empty task list (new user)

## Common issues
- "Missing Supabase env vars": env vars not set in Vercel (or not set for the correct environment)
- 401/403 on queries: RLS policies not applied, or anonymous auth not enabled
