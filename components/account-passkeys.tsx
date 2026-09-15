"use client";

import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export type PasskeyRow = {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
};

async function readError(res: Response, fallback: string) {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function AccountPasskeys({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  // Client-only capability: read it through useSyncExternalStore so the server
  // render stays consistent and no effect has to write state.
  const supported = useSyncExternalStore(
    () => () => {},
    () => browserSupportsWebAuthn(),
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toDelete, setToDelete] = useState<PasskeyRow | null>(null);

  async function register() {
    setBusy(true);
    try {
      const optionsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      if (!optionsRes.ok) {
        throw new Error(await readError(optionsRes, "Could not start registration"));
      }
      const optionsJSON = await optionsRes.json();
      const attestation = await startRegistration({ optionsJSON });
      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation }),
      });
      if (!verifyRes.ok) {
        throw new Error(await readError(verifyRes, "Could not save this passkey"));
      }
      toast.success("Passkey added");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add a passkey";
      // An aborted prompt is a choice, not a failure worth shouting about.
      if (!/abort|NotAllowed/i.test(message)) toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/account/passkeys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft }),
      });
      if (!res.ok) throw new Error(await readError(res, "Rename failed"));
      setEditing(null);
      toast.success("Passkey renamed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/account/passkeys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Delete failed"));
      toast.success("Passkey removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device</TableHead>
            <TableHead>Added</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {passkeys.map((passkey) => (
            <TableRow key={passkey.id}>
              <TableCell>
                {editing === passkey.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      id={`passkey-name-${passkey.id}`}
                      name="passkey-name"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="h-8 w-48"
                      autoFocus
                      disabled={busy}
                    />
                    <Button size="sm" disabled={busy} onClick={() => rename(passkey.id)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  passkey.name
                )}
              </TableCell>
              <TableCell>{formatDate(passkey.createdAt)}</TableCell>
              <TableCell>
                {passkey.lastUsedAt ? formatDate(passkey.lastUsedAt) : "never"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Rename ${passkey.name}`}
                    disabled={busy}
                    onClick={() => {
                      setEditing(passkey.id);
                      setDraft(passkey.name);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="text-destructive"
                    aria-label={`Remove ${passkey.name}`}
                    disabled={busy}
                    onClick={() => setToDelete(passkey)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {passkeys.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No passkeys yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Button onClick={register} disabled={busy || !supported}>
        <KeyRound />
        {supported ? "Add this device" : "This browser has no passkey support"}
      </Button>

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove passkey?</DialogTitle>
            <DialogDescription>
              “{toDelete?.name}” stops working for sign-in immediately. The device
              keeps a leftover entry you can delete there too.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const target = toDelete;
                if (!target) return;
                setToDelete(null);
                remove(target.id);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
