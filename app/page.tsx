import { DashboardShell } from "@/components/dashboard-shell";
import { listTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tasks = await listTasks();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <DashboardShell initialTasks={tasks} />
    </main>
  );
}
