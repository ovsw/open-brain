"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ passcode }),
    });

    const body = (await response.json()) as { ok: boolean; error?: string };

    if (!response.ok || !body.ok) {
      setError(body.error === "INVALID_PASSCODE" ? "Incorrect passcode." : "Unable to start session.");
      return;
    }

    startTransition(() => {
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-2.5">
        <Label htmlFor="passcode">Passcode</Label>
        <Input
        id="passcode"
        type="password"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        autoComplete="current-password"
        required
        />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        The session cookie lasts 30 days unless you log out sooner.
      </p>
      {error ? (
        <div className="rounded-[1.15rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Button className="w-full sm:w-auto" type="submit" disabled={isPending}>
        {isPending ? "Unlocking..." : "Unlock dashboard"}
      </Button>
    </form>
  );
}
