"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import { ensureGuestSession, getSupabaseClient } from '@/lib/supabaseClient'
import {
  createDemoTask,
  getOrCreateDemoGuestId,
  loadDemoTasks,
  resetDemoGuestId,
  toggleDemoTaskComplete,
} from '@/lib/demoStore'
import type { Task, TaskPriority } from '@/lib/types'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

function shortId(id: string) {
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export default function Home() {
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null)
  const [mode, setMode] = useState<'supabase' | 'demo'>('supabase')
  const [userId, setUserId] = useState<string | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')


  const canSubmit = useMemo(() => title.trim().length > 0 && !creating, [title, creating])

  useEffect(() => {
    let cancelled = false

    async function init() {
      setError(null)
      setLoadingAuth(true)
      try {
        const client = getSupabaseClient()

        if (!client) {
        if (IS_PRODUCTION) {
          if (!cancelled) {
            setMode('demo')
            setSupabase(null)
            setUserId(null)
            setTasks([])
            setError(
              'This deployment is missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your hosting provider (e.g., Vercel) and redeploy.',
            )
          }
          return
        }

        // Demo mode (local development only)
        const demoUserId = getOrCreateDemoGuestId()
        if (!cancelled) {
          setMode('demo')
          setSupabase(null)
          setUserId(demoUserId)
          setTasks(loadDemoTasks(demoUserId))
        }
        return
			}

        if (!cancelled) {
				setMode('supabase')
				setSupabase(client)
			}

        const session = await ensureGuestSession()
        if (!cancelled) setUserId(session?.user.id ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to create guest session.')
      } finally {
        if (!cancelled) setLoadingAuth(false)
      }
    }

    init()

    let unsub: (() => void) | null = null
    try {
      const client = getSupabaseClient()
      if (client) {
				const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
					setUserId(session?.user.id ?? null)
				})
				unsub = () => sub.subscription.unsubscribe()
			}
    } catch {
      // If env vars are missing, we already show the error state.
    }

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const loadTasks = useCallback(
    async (currentUserId: string) => {
      if (mode === 'demo') {
				setError(null)
				setTasks(loadDemoTasks(currentUserId))
				return
			}
			if (!supabase) return
      setError(null)
      setLoadingTasks(true)
      try {
        const { data, error: selectError } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
        if (selectError) throw selectError
        setTasks((data ?? []) as Task[])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tasks.')
      } finally {
        setLoadingTasks(false)
      }
    },
    [supabase, mode],
  )

  useEffect(() => {
    if (!userId) return
    if (mode === 'supabase' && !supabase) return
    loadTasks(userId)
  }, [userId, supabase, loadTasks, mode])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!userId) return
    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    setCreating(true)
    setError(null)
    try {
      if (mode === 'demo') {
				createDemoTask(userId, {
					title: title.trim(),
					description: description.trim() ? description.trim() : null,
					priority,
					due_date: dueDate ? dueDate : null,
				})
			} else {
				if (!supabase) throw new Error('Supabase client not initialized.')
				const { error: insertError } = await supabase.from('tasks').insert({
					title: title.trim(),
					description: description.trim() ? description.trim() : null,
					priority,
					due_date: dueDate ? dueDate : null,
					user_id: userId,
				})
				if (insertError) throw insertError
			}
      setTitle('')
      setDescription('')
      setPriority('normal')
      setDueDate('')
      await loadTasks(userId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task.')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleComplete(task: Task) {
    if (mode === 'demo') {
        setUpdatingId(task.id)
        setError(null)
        try {
          const next = toggleDemoTaskComplete(task.user_id, task.id)
          setTasks(next)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to update task.')
        } finally {
          setUpdatingId(null)
        }
        return
      }
      if (!supabase) return
    setUpdatingId(task.id)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ is_complete: !task.is_complete })
        .eq('id', task.id)
      if (updateError) throw updateError
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_complete: !t.is_complete } : t)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update task.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleNewGuest() {
    setError(null)
    try {
      if (mode === 'demo') {
				resetDemoGuestId()
			} else {
				if (!supabase) throw new Error('Supabase client not initialized.')
				await supabase.auth.signOut()
			}
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset guest session.')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/30 via-indigo-500/25 to-fuchsia-500/25 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-[520px] w-[520px] rounded-full bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-indigo-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.12)_1px,transparent_0)] [background-size:22px_22px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-cyan-400/20 via-indigo-400/20 to-fuchsia-400/20 ring-1 ring-white/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-cyan-300">
                  <path
                    d="M9 6h11M9 12h11M9 18h11"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4.5 6.5l.7.7 1.8-1.9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4.5 12.5l.7.7 1.8-1.9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4.5 18.5l.7.7 1.8-1.9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Task Manager</h1>
                <p className="text-sm text-slate-300">Supabase + anonymous guest sessions + RLS</p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 sm:justify-start">
                <span className="text-xs text-slate-300">Session</span>
                <span className="text-xs text-slate-200">
                  {loadingAuth ? (
                    <span className="text-slate-300">Creating…</span>
                  ) : userId ? (
                    <span>
                      {mode === 'demo' ? 'Demo' : 'Guest'} <span className="font-mono">{shortId(userId)}</span>
                    </span>
                  ) : (
                    <span className="text-slate-300">None</span>
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={handleNewGuest}
                className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 ring-1 ring-white/10 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loadingAuth}
                title="Sign out and create a new guest session"
              >
                New guest
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-200 ring-1 ring-white/10">
              Total: <span className="font-semibold text-white">{tasks.length}</span>
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-200 ring-1 ring-white/10">
              Completed:{' '}
              <span className="font-semibold text-white">{tasks.filter((t) => t.is_complete).length}</span>
            </span>
            <span className="rounded-full bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 px-3 py-1 text-xs text-cyan-100 ring-1 ring-white/10">
              Techy UI mode
            </span>
          </div>
        </header>

        {mode === 'demo' && !IS_PRODUCTION ? (
          <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-white/10">
            <span className="font-semibold">Demo mode:</span> Supabase isn’t configured yet, so tasks are saved only in this
            browser (localStorage). Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
            `.env.local` to enable real persistence + RLS.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 ring-1 ring-white/10">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.10)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-100">Create task</h2>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                Quick add
              </span>
            </div>
            <form onSubmit={handleCreate} className="mt-4 grid gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (required)"
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 outline-none ring-0 transition focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20"
                disabled={loadingAuth || !userId}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="min-h-[88px] w-full resize-none rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 outline-none transition focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-400/20"
                disabled={loadingAuth || !userId}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-slate-300">
                  Priority
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-fuchsia-400/40 focus:ring-2 focus:ring-fuchsia-400/20"
                    disabled={loadingAuth || !userId}
                  >
                    <option value="low">low</option>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-slate-300">
                  Due date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/20"
                    disabled={loadingAuth || !userId}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={loadingAuth || !userId || !canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/10 transition hover:from-cyan-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? (
                  <span>Creating…</span>
                ) : (
                  <span>Add task</span>
                )}
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.10)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-100">Your tasks</h2>
              <button
                type="button"
                onClick={() => userId && loadTasks(userId)}
                className="inline-flex items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-slate-100 ring-1 ring-white/10 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loadingAuth || !userId || loadingTasks}
              >
                {loadingTasks ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {loadingTasks ? (
              <p className="mt-4 text-sm text-slate-300">Loading tasks…</p>
            ) : tasks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">No tasks yet. Create one on the left.</p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {tasks.map((task) => {
                  const disabled = updatingId === task.id
                  return (
                    <li
                      key={task.id}
                      className="group flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4 transition hover:border-white/15"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                          <span
                            className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ring-white/10 ${
                              task.is_complete
                                ? 'bg-emerald-500/15 text-emerald-200'
                                : 'bg-sky-500/15 text-sky-200'
                            }`}
                          >
                            {task.is_complete ? 'DONE' : 'OPEN'}
                          </span>

                          <p
                            className={`truncate text-sm font-semibold ${
                              task.is_complete ? 'text-slate-400 line-through' : 'text-slate-50'
                            }`}
                          >
                            {task.title}
                          </p>

                          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/10">
                            {task.priority}
                          </span>

                          {task.due_date ? (
                            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/10">
                              due {task.due_date}
                            </span>
                          ) : null}
                        </div>

                        {task.description ? (
                          <p className="mt-2 text-sm text-slate-300">{task.description}</p>
                        ) : null}

                        <p className="mt-3 text-xs text-slate-400">
                          Created {new Date(task.created_at).toLocaleString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task)}
                        disabled={disabled}
                        className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-slate-100 ring-1 ring-white/10 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {task.is_complete ? 'Mark incomplete' : 'Mark complete'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
