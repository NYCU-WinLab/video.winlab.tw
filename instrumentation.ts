export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTranscriptSync } = await import("./lib/transcript-sync");
  startTranscriptSync();
}
