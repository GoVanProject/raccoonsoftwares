// In production the compose proxy serves the frontend and API from the same origin.
// An explicit empty value keeps browser requests relative to that origin.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function taskboardFetch<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Não foi possível concluir a operação.");
  }
  return payload;
}
