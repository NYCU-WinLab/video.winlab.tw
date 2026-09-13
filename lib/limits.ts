/** Upload cap. The request body is buffered in memory by formData(), so this
 * must stay well under the VM's RAM (8 GB + 4 GB swap on VM 114). Keep in
 * sync with proxyClientMaxBodySize in next.config.ts. */
export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;
export const MAX_UPLOAD_LABEL = "2 GB";
