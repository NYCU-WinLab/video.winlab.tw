/** Attributes Safari and iOS use to pick a password that this site accepts. */
export const PASSWORD_RULES: Record<string, string> = {
  passwordrules: "minlength: 8; maxlength: 128;",
};

type PasswordCredentialCtor = new (data: {
  id: string;
  password: string;
  name?: string;
}) => Credential;

/**
 * Tells the browser's password manager about a password the user just set, so
 * it offers to update the saved entry instead of keeping the old one. Silently
 * does nothing where the Credential Management API is missing.
 */
export async function storePasswordCredential(email: string, password: string) {
  if (typeof window === "undefined") return;
  const ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor })
    .PasswordCredential;
  if (!ctor || !navigator.credentials?.store) return;
  try {
    await navigator.credentials.store(new ctor({ id: email, password }));
  } catch {
    // A manager that refuses the hint is not an error worth showing.
  }
}
