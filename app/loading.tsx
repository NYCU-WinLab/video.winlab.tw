import { PageContainer } from "@/components/ui/page-container";
import { VideoLibrarySkeleton } from "@/components/video-library";

export default function Loading() {
  return (
    <PageContainer>
      <VideoLibrarySkeleton />
    </PageContainer>
  );
}
