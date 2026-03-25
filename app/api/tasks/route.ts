import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSessionCookieName, isValidSessionToken } from "@/lib/auth";
import { getSessionSecret } from "@/lib/config";
import { listTasks } from "@/lib/tasks";

async function isAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSessionToken(getSessionSecret(), cookieStore.get(getSessionCookieName())?.value);
}

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const tasks = await listTasks();
    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ ok: false, error: "FETCH_FAILED" }, { status: 500 });
  }
}
