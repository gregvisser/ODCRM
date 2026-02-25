export type UIMode = "agency" | "client";

/**
 * UI mode is a PRESENTATION concern only (for now).
 * Default to 'agency' so there is no behavior change unless explicitly configured.
 *
 * NOTE: Client-mode tenant locking will be implemented later via /api/me.
 */
export function getUIMode(): UIMode {
  // Vite envs exist at build time; keep parsing ultra defensive.
  const raw = (import.meta as any)?.env?.VITE_UI_MODE;
  return raw === "client" ? "client" : "agency";
}

export function isAgencyUI(): boolean {
  return getUIMode() === "agency";
}

export function isClientUI(): boolean {
  return getUIMode() === "client";
}
