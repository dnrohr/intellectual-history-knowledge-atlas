const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};

export const PUBLIC_DEMO_MODE = viteEnv.VITE_PUBLIC_DEMO_MODE === "true";
export const API_BASE_URL = (viteEnv.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
