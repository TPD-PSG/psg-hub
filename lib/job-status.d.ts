export type JobName = "report-import" | "backup-hourly" | "notify-daily" | "backup-daily";
export type JobState = "ok" | "late" | "failing" | "never";
export type JobStatus = { job: JobName; label: string; lateAfterH: number; state: JobState; lastRunAt: string | null; lastOkAt: string | null; summary: string | null };
export const JOBS: Record<JobName, { label: string; lateAfterH: number }>;
export function recordRun(db: unknown, job: JobName, ok: boolean, summary?: string): Promise<void>;
export function readJobStatus(db: unknown, now?: Date): Promise<JobStatus[]>;
export function alertAdmins(db: unknown, now?: Date): Promise<void>;
