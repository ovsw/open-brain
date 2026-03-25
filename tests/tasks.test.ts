import { describe, expect, it } from "vitest";

import { transformTasks } from "@/lib/tasks";
import type { ThoughtTaskRow } from "@/lib/task-types";

function buildRow(overrides: Partial<ThoughtTaskRow>): ThoughtTaskRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    content: overrides.content ?? "Task",
    metadata: "metadata" in overrides ? (overrides.metadata ?? null) : { type: "task" },
    created_at: overrides.created_at ?? "2026-03-24T10:00:00.000Z",
    updated_at: overrides.updated_at ?? null,
  };
}

describe("transformTasks", () => {
  it("filters non-task rows and groups valid tasks", () => {
    const result = transformTasks(
      [
        buildRow({
          id: "overdue",
          metadata: { type: "task", dates_mentioned: ["2026-03-20"], topics: ["ops"], source: "telegram" },
        }),
        buildRow({
          id: "upcoming",
          metadata: { type: "task", dates_mentioned: ["2026-03-26", "2026-03-27"] },
          created_at: "2026-03-22T10:00:00.000Z",
        }),
        buildRow({
          id: "undated",
          metadata: { type: "task", dates_mentioned: ["bad-date"] },
          created_at: "2026-03-25T10:00:00.000Z",
        }),
        buildRow({
          id: "ignore",
          metadata: { type: "note" },
        }),
      ],
      "2026-03-25T09:00:00.000Z",
    );

    expect(result.generatedAt).toBe("2026-03-25T09:00:00.000Z");
    expect(result.overdue.map((task) => task.id)).toEqual(["overdue"]);
    expect(result.upcoming.map((task) => task.id)).toEqual(["upcoming"]);
    expect(result.undated.map((task) => task.id)).toEqual(["undated"]);
    expect(result.overdue[0]).toMatchObject({
      effectiveDueDate: "2026-03-20",
      topics: ["ops"],
      source: "telegram",
      status: "overdue",
    });
  });

  it("uses earliest valid date and breaks ties by newest created_at", () => {
    const result = transformTasks(
      [
        buildRow({
          id: "b",
          created_at: "2026-03-24T11:00:00.000Z",
          metadata: { type: "task", dates_mentioned: ["2026-03-26", "2026-03-30", "bad"] },
        }),
        buildRow({
          id: "a",
          created_at: "2026-03-24T12:00:00.000Z",
          metadata: { type: "task", dates_mentioned: ["2026-03-26"] },
        }),
      ],
      "2026-03-25T09:00:00.000Z",
    );

    expect(result.upcoming.map((task) => task.id)).toEqual(["a", "b"]);
  });

  it("sorts undated tasks by created_at descending and ignores invalid metadata", () => {
    const result = transformTasks(
      [
        buildRow({
          id: "newer",
          created_at: "2026-03-25T12:00:00.000Z",
          metadata: { type: "task" },
        }),
        buildRow({
          id: "older",
          created_at: "2026-03-24T12:00:00.000Z",
          metadata: { type: "task", topics: ["writing"] },
        }),
        buildRow({
          id: "missing-metadata",
          metadata: null,
        }),
      ],
      "2026-03-25T09:00:00.000Z",
    );

    expect(result.undated.map((task) => task.id)).toEqual(["newer", "older"]);
    expect(result.undated[1]?.topics).toEqual(["writing"]);
  });
});
