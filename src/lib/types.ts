export type TaskPriority = 'low' | 'normal' | 'high'

export type Task = {
	id: string
	user_id: string
	title: string
	description: string | null
	priority: TaskPriority
	due_date: string | null
	is_complete: boolean
	created_at: string
}
