const baseUrl = () => process.env.NEXTCLOUD_URL!.replace(/\/$/, "");
const user = () => process.env.NEXTCLOUD_USER!;

export function davAuthHeader() {
  return (
    "Basic " +
    Buffer.from(`${user()}:${process.env.NEXTCLOUD_APP_PASSWORD}`).toString(
      "base64",
    )
  );
}

export function davUrl(filename: string) {
  return `${baseUrl()}/remote.php/dav/files/${user()}/videos/${encodeURIComponent(filename)}`;
}

export async function davPut(filename: string, body: ReadableStream) {
  const res = await fetch(davUrl(filename), {
    method: "PUT",
    headers: { Authorization: davAuthHeader() },
    body,
    // @ts-expect-error duplex is required by undici for streaming bodies
    duplex: "half",
  });
  if (!res.ok) {
    throw new Error(`WebDAV PUT failed: ${res.status} ${await res.text()}`);
  }
}

export async function davGet(filename: string, range?: string | null) {
  return fetch(davUrl(filename), {
    headers: {
      Authorization: davAuthHeader(),
      ...(range ? { Range: range } : {}),
    },
  });
}

export async function davDelete(filename: string) {
  const res = await fetch(davUrl(filename), {
    method: "DELETE",
    headers: { Authorization: davAuthHeader() },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`WebDAV DELETE failed: ${res.status}`);
  }
}

/** Cheap reachability check against the videos collection. */
export async function davPing(timeoutMs = 5000) {
  try {
    const res = await fetch(
      `${baseUrl()}/remote.php/dav/files/${user()}/videos/`,
      {
        method: "PROPFIND",
        headers: { Authorization: davAuthHeader(), Depth: "0" },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    await res.body?.cancel();
    return res.ok || res.status === 207;
  } catch {
    return false;
  }
}
