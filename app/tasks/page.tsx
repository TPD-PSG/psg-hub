import TasksPanel from "@/components/TasksPanel";

export default function TasksPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--psg-muted)" }}>Company-wide to-dos not tied to a specific production</p>
      </div>
      <TasksPanel />
    </div>
  );
}
