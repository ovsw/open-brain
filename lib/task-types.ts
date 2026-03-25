export type ThoughtTaskMetadata = {
  type?: string;
  dates_mentioned?: string[];
  topics?: string[];
  action_items?: string[];
  people?: string[];
  source?: string;
  telegram_chat_id?: string;
  telegram_chat_type?: string;
  telegram_message_id?: string;
  telegram_username?: string;
  [key: string]: unknown;
};

export type ThoughtTaskRow = {
  id: string;
  content: string;
  metadata: ThoughtTaskMetadata | null;
  created_at: string;
  updated_at: string | null;
};

export type TaskStatus = "overdue" | "upcoming" | "undated";

export type TaskDto = {
  id: string;
  content: string;
  createdAt: string;
  effectiveDueDate: string | null;
  status: TaskStatus;
  topics: string[];
  source: string | null;
};

export type TasksResponse = {
  overdue: TaskDto[];
  upcoming: TaskDto[];
  undated: TaskDto[];
  generatedAt: string;
};
