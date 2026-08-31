import Link from "next/link";
import { auth, signOut } from "@/auth";
import { UserMenu } from "@/components/user-menu";

export async function SiteHeader({ crumb }: { crumb?: string }) {
  const session = await auth();
  if (!session) return null;

  return (
    <header className="border-b">
      <div className="flex w-full items-center gap-2 px-6 py-3">
        <Link href="/" className="font-semibold">
          WinLab Video
        </Link>
        {crumb && (
          <span className="truncate text-sm text-muted-foreground">
            / {crumb}
          </span>
        )}
        <div className="ml-auto">
          <UserMenu
            name={session.user.name ?? session.user.email ?? "Account"}
            isAdmin={session.user.isAdmin}
            signOutAction={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          />
        </div>
      </div>
    </header>
  );
}
