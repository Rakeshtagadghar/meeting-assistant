export interface ConsentResult {
  confirmed: boolean;
  text: string | null;
}

export function validateConsent(
  confirmed: boolean,
  text: string | null,
): ConsentResult {
  if (!confirmed) {
    return { confirmed: false, text: null };
  }
  return { confirmed: true, text: text ?? "User consented to recording." };
}
