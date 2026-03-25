import { DashboardShell } from "@/components/dashboard-shell";
import { listTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tasks = await listTasks();

  return (
    <main className="page-shell">
      <DashboardShell initialTasks={tasks} />
    </main>
  );
}
