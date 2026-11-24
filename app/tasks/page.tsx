// Server side of My Tasks: your tasks, the user list and anything awaiting your sign-off arrive
// with the page (same API and checks as the browser).
import { auth } from "@/auth";
import { serverApi } from "@/lib/serverApi";
import type { Task, User } from "@/components/TasksPanel";
import TasksView, { type SignoffTask } from "./TasksView";

export default async function TasksPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const userId = Number(user?.id) || null;
  if (!userId) return <TasksView initial={null} />;
  const [signoff, tasks, users] = await Promise.all([
    serverApi<SignoffTask[]>(`/api/tasks?signoffUserId=${userId}&status=awaiting_signoff`),
    serverApi<Task[]>("/api/tasks?myTasks=1"),
    serverApi<User[]>("/api/users"),
  ]);
  const ok = Array.isArray(signoff) && Array.isArray(tasks) && Array.isArray(users);
  return <TasksView initial={ok ? { userId, role: user?.role ?? "member", signoff, tasks, users } : null} />;
}
