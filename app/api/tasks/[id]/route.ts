import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSessionCookieName, isValidSessionToken } from "@/lib/auth";
import { getSessionSecret } from "@/lib/config";
import { deleteTask } from "@/lib/tasks";

async function isAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSessionToken(getSessionSecret(), cookieStore.get(getSessionCookieName())?.value);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const deleted = await deleteTask(id);

    if (!deleted) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ ok: false, error: "DELETE_FAILED" }, { status: 500 });
  }
}
