const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};

export const PUBLIC_DEMO_MODE = viteEnv.VITE_PUBLIC_DEMO_MODE === "true";
