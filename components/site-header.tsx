import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await auth();
  if (!session) return null;

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <Link href="/" className="font-semibold">
          WinLab Video
        </Link>
        {session.user.isAdmin && (
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            Admin
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3">
          {session.user.isAdmin && <Badge variant="secondary">admin</Badge>}
          <span className="text-sm text-muted-foreground">
            {session.user.name ?? session.user.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
