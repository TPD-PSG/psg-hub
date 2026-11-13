"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import TasksPanel from "@/components/TasksPanel";

type SignoffTask = {
  id: number; title: string; status: string; priority: string;
  dueDate: string | null;
  production?: { id: number; name: string } | null;
  assigneeUser?: { name: string; avatarUrl?: string | null } | null;
  assigneeName?: string | null;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-white/40", medium: "text-yellow-400", high: "text-red-400",
};

export default function TasksPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";
  const userId = (session?.user as any)?.id ? Number((session!.user as any).id) : null;
  const [signoffTasks, setSignoffTasks] = useState<SignoffTask[]>([]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/tasks?signoffUserId=${userId}&status=awaiting_signoff`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSignoffTasks(d); });
  }, [userId]);

  async function approveSignoff(task: SignoffTask) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: task.title, status: "done", priority: task.priority,
        dueDate: task.dueDate, signoffAt: new Date().toISOString(),
        requiresSignoff: true, signoffUserId: userId,
      }),
    });
    setSignoffTasks(t => t.filter(x => x.id !== task.id));
  }

  return (
    <div className="space-y-8">
      {/* Sign-off panel — only shown when there are tasks awaiting your approval */}
      {signoffTasks.length > 0 && (
        <div className="rounded-xl border p-5 space-y-3" style={{ backgroundColor: "rgba(234,179,8,0.06)", borderColor: "rgba(234,179,8,0.3)" }}>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-lg">✍</span>
            <h2 className="font-semibold text-yellow-300">Awaiting your sign-off ({signoffTasks.length})</h2>
          </div>
          <div className="space-y-2">
            {signoffTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: "rgba(234,179,8,0.2)", backgroundColor: "rgba(234,179,8,0.04)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{task.title}</span>
                    <span className={`text-xs font-semibold ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority === "high" ? "▲ High" : task.priority === "low" ? "▼ Low" : ""}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5 flex gap-3" style={{ color: "var(--psg-muted)" }}>
                    {(task.assigneeUser || task.assigneeName) && (
                      <span>From: <span className="text-white/60">{task.assigneeUser?.name ?? task.assigneeName}</span></span>
                    )}
                    {task.production && (
                      <Link href={`/productions/${task.production.id}?tab=tasks`} className="hover:text-white/80 transition-colors">
                        {task.production.name}
                      </Link>
                    )}
                    {task.dueDate && (
                      <span className={new Date(task.dueDate) < new Date() ? "text-red-400" : ""}>
                        Due: {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => approveSignoff(task)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: "rgba(234,179,8,0.2)", color: "#fde047" }}
                >
                  ✓ Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>
          {role === "admin" ? "Company-wide to-dos not tied to a specific production" : "All tasks assigned to you"}
        </p>
      </div>
      <TasksPanel />
    </div>
  );
}
