import { asc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNav } from "@/components/admin-nav";
import { AdminUsers, type AdminUserRow } from "@/components/admin-users";
import { SiteHeader } from "@/components/site-header";
import { isBootstrapAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { tags, userTags, users } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user.isAdmin) redirect("/");

  const [userRows, tagRows, assigned] = await Promise.all([
    db.select().from(users).orderBy(asc(sql`lower(${users.email})`)),
    db.select().from(tags).orderBy(asc(sql`lower(${tags.name})`)),
    db.select().from(userTags),
  ]);

  const tagsOf = new Map<string, string[]>();
  for (const row of assigned) {
    tagsOf.set(row.userEmail, [...(tagsOf.get(row.userEmail) ?? []), row.tagId]);
  }

  const rows: AdminUserRow[] = userRows.map((user) => ({
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    tagIds: tagsOf.get(user.email) ?? [],
    locked: isBootstrapAdmin(user.email),
  }));

  return (
    <>
      <SiteHeader crumb="Admin / Users" />
      <main className="w-full flex-1 space-y-6 p-6">
        <AdminNav current="/admin/users" />
        <p className="text-sm text-muted-foreground">
          Only these emails can sign in, with Google or with an email code. Tags
          decide which locked videos they see.
        </p>
        <AdminUsers users={rows} tags={tagRows} />
      </main>
    </>
  );
}
