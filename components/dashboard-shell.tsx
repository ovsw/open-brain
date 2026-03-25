"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { TaskDto, TasksResponse } from "@/lib/task-types";

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
  onDelete: (id: string) => Promise<void>;
  onToggleComplete: (id: string) => void;
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatDueDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}

function TaskSection({
  title,
  description,
  tasks,
  completedIds,
  showCompleted,
  deletingId,
  onDelete,
  onToggleComplete,
}: TaskSectionProps) {
  const visibleTasks = showCompleted ? tasks : tasks.filter((task) => !completedIds.has(task.id));

  return (
    <section className="section-card glass-panel">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="section-meta">
          {visibleTasks.length} visible / {tasks.length} total
        </span>
      </div>
      <p className="section-meta">{description}</p>
      {visibleTasks.length === 0 ? (
        <EmptyState text={showCompleted ? "Nothing in this section yet." : "All visible tasks here are completed."} />
      ) : (
        <div className="task-grid">
          {visibleTasks.map((task) => {
            const isComplete = completedIds.has(task.id);

            return (
              <article key={task.id} className={`task-card ${isComplete ? "is-complete" : ""}`}>
                <div className="task-header">
                  <span className="badge" data-status={task.status}>
                    {task.status === "undated"
                      ? "No due date"
                      : task.status === "overdue"
                        ? "Overdue"
                        : "Upcoming"}
                  </span>
                  {task.effectiveDueDate ? <span className="summary-pill">Due {formatDueDate(task.effectiveDueDate)}</span> : null}
                </div>
                <p className="task-content">{task.content}</p>
                <div className="task-tags">
                  <span className="task-meta">Captured {formatDate(task.createdAt)}</span>
                  {task.source ? <span className="source-chip">{task.source}</span> : null}
                  {task.topics.map((topic) => (
                    <span key={topic} className="topic-chip">
                      {topic}
                    </span>
                  ))}
                </div>
                <div className="task-actions">
                  <button className="secondary-button" type="button" onClick={() => onToggleComplete(task.id)}>
                    {isComplete ? "Mark active" : "Complete"}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={deletingId === task.id}
                    onClick={() => void onDelete(task.id)}
                  >
                    {deletingId === task.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getAllTasks(tasks: TasksResponse): TaskDto[] {
  return [...tasks.overdue, ...tasks.upcoming, ...tasks.undated];
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

export function DashboardShell({ initialTasks }: DashboardShellProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isLoggingOut, startLogoutTransition] = useTransition();

  useEffect(() => {
    const nextIds = new Set(readCompletedIds());
    setCompletedIds(nextIds);
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
      <header className="dashboard-header glass-panel">
        <div>
          <p className="eyebrow">Open Brain</p>
          <h1 className="dashboard-title">Task dashboard</h1>
        </div>
        <div className="dashboard-summary">
          <span className="summary-pill">
            <strong>{summary.visible}</strong>
            visible
          </span>
          <span className="summary-pill">
            <strong>{summary.total}</strong>
            total
          </span>
          <span className="summary-pill">
            <strong>{summary.completed}</strong>
            completed
          </span>
          <span className="summary-pill">Server baseline {formatDate(tasks.generatedAt)}</span>
        </div>
        <div className="toolbar">
          <label className="toggle">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
            />
            <span>Show completed</span>
          </label>
          <div className="toolbar-actions">
            <button
              className="ghost-button"
              type="button"
              disabled={isRefreshing}
              onClick={() =>
                startRefreshTransition(() => {
                  void refreshTasks();
                })
              }
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button className="ghost-button" type="button" disabled={isLoggingOut} onClick={() => void handleLogout()}>
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
      </header>

      <div className="sections">
        <TaskSection
          title="Overdue"
          description="Oldest due dates rise to the top so neglected tasks stay hard to ignore."
          tasks={tasks.overdue}
          completedIds={completedIds}
          showCompleted={showCompleted}
          deletingId={deletingId}
          onDelete={handleDelete}
          onToggleComplete={handleToggleComplete}
        />
        <TaskSection
          title="Upcoming"
          description="Today and future items sorted by the nearest due date."
          tasks={tasks.upcoming}
          completedIds={completedIds}
          showCompleted={showCompleted}
          deletingId={deletingId}
          onDelete={handleDelete}
          onToggleComplete={handleToggleComplete}
        />
        <TaskSection
          title="No due date"
          description="Tasks without a valid date, newest captures first."
          tasks={tasks.undated}
          completedIds={completedIds}
          showCompleted={showCompleted}
          deletingId={deletingId}
          onDelete={handleDelete}
          onToggleComplete={handleToggleComplete}
        />
      </div>
    </>
  );
}
