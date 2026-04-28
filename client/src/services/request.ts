export type RequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

const buildUrl = (path: string) => {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

export const request = async (path: string, options: RequestOptions = {}) => {
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(path), {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  return response;
};
