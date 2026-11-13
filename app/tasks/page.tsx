"use client";

import { useSession } from "next-auth/react";
import TasksPanel from "@/components/TasksPanel";

export default function TasksPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";
  return (
    <div className="space-y-5">
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
