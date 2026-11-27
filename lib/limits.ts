/** Upload cap. POST /api/videos streams the body to Nextcloud and checks the
 * declared Content-Length against this before it reads the body. */
export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;
export const MAX_UPLOAD_LABEL = "2 GB";

/** Upload titles travel in a request header, so keep them well under the
 * 16 KB header limit even after URI encoding. */
export const MAX_TITLE_LENGTH = 300;
