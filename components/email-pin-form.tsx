"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function readError(res: Response, fallback: string) {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function EmailPinForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/auth/pin/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not send a code"));
      const data = (await res.json()) as { dev?: boolean };
      setStep("code");
      setNote(
        data.dev
          ? "Mail is not configured here, the code is in the server log."
          : `Code sent to ${email}. It expires in 10 minutes.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("email-pin", { email, code, redirect: false });
    if (res?.error) {
      setError("That code is wrong or has expired.");
      setCode("");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={requestCode} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="pin-email">Email</Label>
          <Input
            id="pin-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Email me a code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="pin-code">Sign-in code</Label>
        <Input
          id="pin-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
          autoFocus
          disabled={busy}
        />
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={busy}
        onClick={() => {
          setStep("email");
          setCode("");
          setError(null);
          setNote(null);
        }}
      >
        Use another email
      </Button>
    </form>
  );
}
