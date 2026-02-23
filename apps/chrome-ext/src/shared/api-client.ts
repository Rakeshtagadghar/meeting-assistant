import { getAuthState } from "./storage";
import { DEFAULT_WEB_BASE_URL } from "./constants";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
  baseUrl?: string,
): Promise<Response> {
  const auth = await getAuthState();
  if (!auth.token) {
    throw new ApiError("Not authenticated", 401);
  }

  const base = baseUrl ?? DEFAULT_WEB_BASE_URL;
  const url = `${base}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new ApiError("Authentication expired", 401);
  }

  if (!response.ok) {
    throw new ApiError(`API error: ${response.status}`, response.status);
  }

  return response;
}

export async function transcribeChunk(
  audioBase64: string,
  mimeType: string = "audio/webm",
  baseUrl?: string,
): Promise<{ text: string }> {
  const response = await authenticatedFetch(
    "/api/asr/elevenlabs/transcribe",
    {
      method: "POST",
      body: JSON.stringify({ audioBase64, mimeType }),
    },
    baseUrl,
  );
  return response.json() as Promise<{ text: string }>;
}
