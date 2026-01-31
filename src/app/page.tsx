"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import { ensureGuestSession, getSupabaseClient } from '@/lib/supabaseClient'
import type { Task, TaskPriority } from '@/lib/types'

function shortId(id: string) {
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export default function Home() {
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseClient> | null>(null)
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
        if (!cancelled) setSupabase(client)

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
      const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
        setUserId(session?.user.id ?? null)
      })
      unsub = () => sub.subscription.unsubscribe()
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
    [supabase],
  )

  useEffect(() => {
    if (!userId || !supabase) return
    loadTasks(userId)
  }, [userId, supabase, loadTasks])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!userId || !supabase) return
    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const { error: insertError } = await supabase.from('tasks').insert({
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        priority,
        due_date: dueDate ? dueDate : null,
        user_id: userId,
      })
      if (insertError) throw insertError
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
    if (!supabase) return
    setError(null)
    try {
      await supabase.auth.signOut()
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset guest session.')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Task Manager</h1>
              <p className="text-sm text-zinc-600">Supabase + anonymous guest sessions + RLS</p>
            </div>
            <button
              type="button"
              onClick={handleNewGuest}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
              disabled={loadingAuth}
              title="Sign out and create a new guest session"
            >
              New guest
            </button>
          </div>

          <div className="text-xs text-zinc-600">
            {loadingAuth ? (
              <span>Creating guest session…</span>
            ) : userId ? (
              <span>
                Guest user: <span className="font-mono">{shortId(userId)}</span>
              </span>
            ) : (
              <span>Not signed in.</span>
            )}
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-700">Create task</h2>
          <form onSubmit={handleCreate} className="mt-3 grid gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (required)"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              disabled={loadingAuth || !userId}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="min-h-[72px] w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              disabled={loadingAuth || !userId}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-zinc-600">
                Priority
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  disabled={loadingAuth || !userId}
                >
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-zinc-600">
                Due date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  disabled={loadingAuth || !userId}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={loadingAuth || !userId || !canSubmit}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Add task'}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-700">Your tasks</h2>
            <button
              type="button"
              onClick={() => userId && loadTasks(userId)}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
              disabled={loadingAuth || !userId || loadingTasks}
            >
              {loadingTasks ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {loadingTasks ? (
            <p className="mt-4 text-sm text-zinc-600">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No tasks yet. Create one above.</p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {tasks.map((task) => {
                const disabled = updatingId === task.id
                return (
                  <li
                    key={task.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p
                          className={`truncate text-sm font-medium ${
                            task.is_complete ? 'text-zinc-500 line-through' : 'text-zinc-900'
                          }`}
                        >
                          {task.title}
                        </p>
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                          {task.priority}
                        </span>
                        {task.due_date ? (
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                            due {task.due_date}
                          </span>
                        ) : null}
                      </div>
                      {task.description ? (
                        <p className="mt-1 text-sm text-zinc-600">{task.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-zinc-500">
                        Created {new Date(task.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(task)}
                      disabled={disabled}
                      className="shrink-0 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
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
  )
}
