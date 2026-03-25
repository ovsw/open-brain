import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createSessionToken,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth";
import { getDashboardPasscode, getSessionSecret } from "@/lib/config";

type SessionRequestBody = {
  passcode?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SessionRequestBody;

  if (body.passcode !== getDashboardPasscode()) {
    return NextResponse.json({ ok: false, error: "INVALID_PASSCODE" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: getSessionCookieName(),
    value: await createSessionToken(getSessionSecret()),
    ...getSessionCookieOptions(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: getSessionCookieName(),
    value: "",
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
