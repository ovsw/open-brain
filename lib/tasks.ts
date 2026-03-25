import { createServerSupabaseClient } from "@/lib/supabase";
import type { TaskDto, TasksResponse, ThoughtTaskMetadata, ThoughtTaskRow } from "@/lib/task-types";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThoughtTaskMetadata(value: unknown): value is ThoughtTaskMetadata {
  return isObjectRecord(value);
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return candidate.toISOString().slice(0, 10) === value;
}

function getEffectiveDueDate(metadata: ThoughtTaskMetadata | null): string | null {
  if (!metadata || !Array.isArray(metadata.dates_mentioned)) {
    return null;
  }

  const validDates = metadata.dates_mentioned.filter(
    (date): date is string => typeof date === "string" && isValidDateOnly(date),
  );

  if (validDates.length === 0) {
    return null;
  }

  return [...validDates].sort((left, right) => left.localeCompare(right))[0] ?? null;
}

function normalizeTopics(metadata: ThoughtTaskMetadata | null): string[] {
  if (!metadata || !Array.isArray(metadata.topics)) {
    return [];
  }

  return metadata.topics.filter((topic): topic is string => typeof topic === "string" && topic.trim().length > 0);
}

function normalizeSource(metadata: ThoughtTaskMetadata | null): string | null {
  if (!metadata || typeof metadata.source !== "string" || metadata.source.trim().length === 0) {
    return null;
  }

  return metadata.source;
}

function toTaskDto(row: ThoughtTaskRow, todayUtc: string): TaskDto | null {
  const metadata = row.metadata;

  if (!isThoughtTaskMetadata(metadata) || metadata.type !== "task") {
    return null;
  }

  const effectiveDueDate = getEffectiveDueDate(metadata);
  const status = effectiveDueDate === null ? "undated" : effectiveDueDate < todayUtc ? "overdue" : "upcoming";

  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    effectiveDueDate,
    status,
    topics: normalizeTopics(metadata),
    source: normalizeSource(metadata),
  };
}

function compareByCreatedAtDesc(left: TaskDto, right: TaskDto): number {
  return right.createdAt.localeCompare(left.createdAt);
}

function compareDatedTasks(left: TaskDto, right: TaskDto): number {
  const dueDateComparison = (left.effectiveDueDate ?? "").localeCompare(right.effectiveDueDate ?? "");

  if (dueDateComparison !== 0) {
    return dueDateComparison;
  }

  return compareByCreatedAtDesc(left, right);
}

export function transformTasks(rows: ThoughtTaskRow[], generatedAt = new Date().toISOString()): TasksResponse {
  const todayUtc = generatedAt.slice(0, 10);
  const tasks = rows
    .map((row) => toTaskDto(row, todayUtc))
    .filter((task): task is TaskDto => task !== null);

  const overdue = tasks.filter((task) => task.status === "overdue").sort(compareDatedTasks);
  const upcoming = tasks.filter((task) => task.status === "upcoming").sort(compareDatedTasks);
  const undated = tasks.filter((task) => task.status === "undated").sort(compareByCreatedAtDesc);

  return {
    overdue,
    upcoming,
    undated,
    generatedAt,
  };
}

export async function listTasks(): Promise<TasksResponse> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("thoughts")
    .select("id, content, metadata, created_at, updated_at")
    .contains("metadata", { type: "task" });

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  return transformTasks((data ?? []) as ThoughtTaskRow[]);
}

export async function deleteTask(id: string): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("thoughts").delete().eq("id", id).select("id").maybeSingle();

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }

  return Boolean(data?.id);
}
