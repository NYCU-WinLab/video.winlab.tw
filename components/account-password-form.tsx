"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_RULES, storePasswordCredential } from "@/lib/credential-manager";

async function readError(res: Response, fallback: string) {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AccountPasswordForm({
  email,
  hasPassword,
}: {
  email: string;
  hasPassword: boolean;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (next !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not change the password"));
      await storePasswordCredential(email, next);
      toast.success(hasPassword ? "Password changed" : "Password set");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-3" method="post">
      <input
        type="hidden"
        id="account-email"
        name="email"
        value={email}
        autoComplete="username"
        readOnly
      />
      {hasPassword && (
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            name="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            disabled={busy}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          {...PASSWORD_RULES}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          disabled={busy}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          {...PASSWORD_RULES}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          disabled={busy}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </Button>
    </form>
  );
}
