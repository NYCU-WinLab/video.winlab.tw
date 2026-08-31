const baseUrl = () => process.env.NEXTCLOUD_URL!.replace(/\/$/, "");
const user = () => process.env.NEXTCLOUD_USER!;

function authHeader() {
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
    headers: { Authorization: authHeader() },
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
      Authorization: authHeader(),
      ...(range ? { Range: range } : {}),
    },
  });
}

export async function davDelete(filename: string) {
  const res = await fetch(davUrl(filename), {
    method: "DELETE",
    headers: { Authorization: authHeader() },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`WebDAV DELETE failed: ${res.status}`);
  }
}
