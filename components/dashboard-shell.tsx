"use client";

import { useRouter } from "next/navigation";
import { RefreshCcw, LogOut, CalendarClock, Clock3, Inbox, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import type { TaskDto, TaskStatus, TasksResponse } from "@/lib/task-types";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const COMPLETED_STORAGE_KEY = "open-brain-completed-task-ids-v1";

type DashboardShellProps = {
  initialTasks: TasksResponse;
};

type TaskSectionProps = {
  title: string;
  description: string;
  tasks: TaskDto[];
  completedIds: Set<string>;
  showCompleted: boolean;
  deletingId: string | null;
  onRequestDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
};

const statusIconMap: Record<TaskStatus, typeof Clock3> = {
  overdue: Clock3,
  upcoming: CalendarClock,
  undated: Inbox,
};

const statusLabelMap: Record<TaskStatus, string> = {
  overdue: "Overdue",
  upcoming: "Upcoming",
  undated: "No due date",
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatDueDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function readCompletedIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(COMPLETED_STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeCompletedIds(ids: Set<string>) {
  window.localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify([...ids]));
}

function getAllTasks(tasks: TasksResponse): TaskDto[] {
  return [...tasks.overdue, ...tasks.upcoming, ...tasks.undated];
}

function pruneCompletedIds(current: Set<string>, tasks: TasksResponse) {
  const validIds = new Set(getAllTasks(tasks).map((task) => task.id));
  const next = new Set([...current].filter((id) => validIds.has(id)));
  writeCompletedIds(next);
  return next;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-background/55 px-5 py-8 text-center text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={status}>{statusLabelMap[status]}</Badge>;
}

function TaskSection({
  title,
  description,
  tasks,
  completedIds,
  showCompleted,
  deletingId,
  onRequestDelete,
  onToggleComplete,
}: TaskSectionProps) {
  const visibleTasks = showCompleted ? tasks : tasks.filter((task) => !completedIds.has(task.id));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-[2rem] leading-none">{title}</CardTitle>
            <CardDescription className="max-w-2xl text-sm">{description}</CardDescription>
          </div>
          <div className="inline-flex w-fit items-center rounded-full border border-border/60 bg-white/50 px-4 py-2 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {visibleTasks.length} visible / {tasks.length} total
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visibleTasks.length === 0 ? (
          <EmptyState text={showCompleted ? "Nothing in this section yet." : "All visible tasks here are completed."} />
        ) : (
          <div className="grid gap-4">
            {visibleTasks.map((task) => {
              const isComplete = completedIds.has(task.id);
              const StatusIcon = statusIconMap[task.status];

              return (
                <article
                  key={task.id}
                  className={cn(
                    "group rounded-[1.55rem] border border-border/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(255,249,243,0.95))] p-5 shadow-[0_18px_48px_rgba(92,58,35,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(92,58,35,0.12)]",
                    isComplete && "opacity-55 saturate-75",
                  )}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <StatusBadge status={task.status} />
                        {task.source ? (
                          <Badge variant="secondary" className="tracking-[0.12em]">
                            {task.source}
                          </Badge>
                        ) : null}
                        {task.topics.map((topic) => (
                          <Badge key={topic} variant="secondary" className="tracking-[0.08em] normal-case">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                      <div className="inline-flex items-center gap-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
                        <StatusIcon className="size-3.5" />
                        Captured {formatDate(task.createdAt)}
                      </div>
                    </div>

                    <p className={cn("text-base leading-8 text-foreground sm:text-[1.05rem]", isComplete && "line-through")}>
                      {task.content}
                    </p>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-muted-foreground">
                        {task.effectiveDueDate ? (
                          <span>
                            Due <span className="font-medium text-foreground">{formatDueDate(task.effectiveDueDate)}</span>
                          </span>
                        ) : (
                          "No due date attached to this task."
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <label
                          htmlFor={`complete-${task.id}`}
                          className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-border/65 bg-white/55 px-3.5 py-2 text-sm text-foreground"
                        >
                          <Checkbox
                            id={`complete-${task.id}`}
                            checked={isComplete}
                            onCheckedChange={() => onToggleComplete(task.id)}
                          />
                          <span>Complete</span>
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          disabled={deletingId === task.id}
                          onClick={() => onRequestDelete(task.id)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          {deletingId === task.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardShell({ initialTasks }: DashboardShellProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isLoggingOut, startLogoutTransition] = useTransition();

  useEffect(() => {
    setCompletedIds(new Set(readCompletedIds()));
  }, []);

  const allTasks = getAllTasks(tasks);
  const summary = {
    total: allTasks.length,
    visible: showCompleted ? allTasks.length : allTasks.filter((task) => !completedIds.has(task.id)).length,
    completed: allTasks.filter((task) => completedIds.has(task.id)).length,
  };

  function handleToggleComplete(id: string) {
    setCompletedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      writeCompletedIds(next);
      return next;
    });
  }

  async function refreshTasks() {
    setError(null);

    const response = await fetch("/api/tasks", {
      cache: "no-store",
    });

    if (response.status === 401) {
      router.push("/login");
      router.refresh();
      return;
    }

    if (!response.ok) {
      setError("Unable to refresh tasks.");
      return;
    }

    const body = (await response.json()) as TasksResponse;
    setTasks(body);
    setCompletedIds((current) => pruneCompletedIds(current, body));
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);

    const response = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
    });

    const body = (await response.json()) as { ok: boolean; error?: string };

    if (response.status === 401 || body.error === "UNAUTHORIZED") {
      router.push("/login");
      router.refresh();
      return;
    }

    if (!response.ok || !body.ok) {
      setDeletingId(null);
      setError(body.error === "NOT_FOUND" ? "Task no longer exists." : "Unable to delete task.");
      return;
    }

    setTasks((current) => ({
      ...current,
      overdue: current.overdue.filter((task) => task.id !== id),
      upcoming: current.upcoming.filter((task) => task.id !== id),
      undated: current.undated.filter((task) => task.id !== id),
    }));

    setCompletedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      writeCompletedIds(next);
      return next;
    });

    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  async function handleLogout() {
    await fetch("/api/session", {
      method: "DELETE",
    });

    startLogoutTransition(() => {
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="gap-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-semibold tracking-[0.36em] text-muted-foreground uppercase">Open Brain</p>
                  <CardTitle className="max-w-2xl text-4xl leading-none sm:text-5xl lg:text-[3.6rem]">
                    Task dashboard
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-base">
                    A warm, persistent view of what is overdue, what is approaching, and what still needs a date.
                  </CardDescription>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryPill label="Visible" value={summary.visible} accent="text-status-overdue" />
                  <SummaryPill label="Total" value={summary.total} accent="text-foreground" />
                  <SummaryPill label="Completed" value={summary.completed} accent="text-status-upcoming" />
                  <SummaryPill
                    label="Server baseline"
                    value={formatDate(tasks.generatedAt)}
                    accent="text-status-undated"
                    compact
                  />
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 rounded-[1.5rem] border border-border/60 bg-white/40 p-4 lg:max-w-md">
                <div className="flex items-center justify-between gap-4 rounded-[1.2rem] bg-background/65 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Show completed</p>
                    <p className="text-sm text-muted-foreground">Reveal locally completed tasks in-place.</p>
                  </div>
                  <Switch checked={showCompleted} onCheckedChange={setShowCompleted} aria-label="Show completed tasks" />
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={isRefreshing}
                    onClick={() =>
                      startRefreshTransition(() => {
                        void refreshTasks();
                      })
                    }
                  >
                    <RefreshCcw className={cn("size-4", isRefreshing && "animate-spin")} />
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Button variant="ghost" type="button" disabled={isLoggingOut} onClick={() => void handleLogout()}>
                    <LogOut className="size-4" />
                    {isLoggingOut ? "Logging out..." : "Log out"}
                  </Button>
                </div>
              </div>
            </div>
            {error ? (
              <div className="rounded-[1.15rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardHeader>
        </Card>

        <div className="grid gap-5">
          <TaskSection
            title="Overdue"
            description="Oldest due dates rise to the top so neglected tasks stay hard to ignore."
            tasks={tasks.overdue}
            completedIds={completedIds}
            showCompleted={showCompleted}
            deletingId={deletingId}
            onRequestDelete={setConfirmDeleteId}
            onToggleComplete={handleToggleComplete}
          />
          <TaskSection
            title="Upcoming"
            description="Today and future items sorted by the nearest due date."
            tasks={tasks.upcoming}
            completedIds={completedIds}
            showCompleted={showCompleted}
            deletingId={deletingId}
            onRequestDelete={setConfirmDeleteId}
            onToggleComplete={handleToggleComplete}
          />
          <TaskSection
            title="No due date"
            description="Tasks without a clean due date stay visible until they are clarified or removed."
            tasks={tasks.undated}
            completedIds={completedIds}
            showCompleted={showCompleted}
            deletingId={deletingId}
            onRequestDelete={setConfirmDeleteId}
            onToggleComplete={handleToggleComplete}
          />
        </div>
      </div>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task from Supabase immediately. Local completion state will also be cleared for this row.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId === confirmDeleteId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmDeleteId || deletingId === confirmDeleteId}
              onClick={(event) => {
                event.preventDefault();

                if (confirmDeleteId) {
                  void handleDelete(confirmDeleteId);
                }
              }}
            >
              {deletingId === confirmDeleteId ? "Deleting..." : "Delete task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SummaryPill({
  label,
  value,
  accent,
  compact = false,
}: {
  label: string;
  value: string | number;
  accent: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[1.4rem] border border-border/60 bg-white/45 px-4 py-3">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <p className={cn("mt-2 font-serif text-3xl leading-none", compact ? "text-lg sm:text-xl" : "text-3xl", accent)}>{value}</p>
    </div>
  );
}
