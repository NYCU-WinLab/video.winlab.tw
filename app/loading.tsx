import { WideContainer } from "@/components/ui/wide-container";
import { VideoLibrarySkeleton } from "@/components/video-library";

export default function Loading() {
  return (
    <WideContainer>
      <VideoLibrarySkeleton />
    </WideContainer>
  );
}
