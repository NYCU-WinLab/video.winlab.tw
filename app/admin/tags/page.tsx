import { asc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNav } from "@/components/admin-nav";
import { AdminTags, type AdminTagRow } from "@/components/admin-tags";
import { CreateTagDialog } from "@/components/create-tag-dialog";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/lib/db";
import { tags, userTags, videoTags } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function AdminTagsPage() {
  const session = await auth();
  if (!session?.user.isAdmin) redirect("/");

  const [tagRows, userLinks, videoLinks] = await Promise.all([
    db.select().from(tags).orderBy(asc(sql`lower(${tags.name})`)),
    db.select().from(userTags),
    db.select().from(videoTags),
  ]);

  const rows: AdminTagRow[] = tagRows.map((tag) => ({
    ...tag,
    users: userLinks.filter((l) => l.tagId === tag.id).length,
    videos: videoLinks.filter((l) => l.tagId === tag.id).length,
  }));

  return (
    <>
      <SiteHeader crumb="Admin / Tags" />
      <main className="w-full flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <AdminNav current="/admin/tags" />
          <CreateTagDialog />
        </div>
        <AdminTags tags={rows} />
      </main>
    </>
  );
}
