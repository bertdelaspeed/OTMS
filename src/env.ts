/**
 * Environment configuration helper
 * Reads VITE_* environment variables (exposed by Vite at build time)
 * Falls back to empty strings if not set
 */

// Access Vite environment variables with type safety
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env || {};

export const env = {
  dbKind: (viteEnv.VITE_DB_KIND || "local") as "local" | "bridge" | "supabase" | "firebase",
  supabaseUrl: viteEnv.VITE_SUPABASE_URL || "",
  supabaseAnonKey: viteEnv.VITE_SUPABASE_ANON_KEY || "",
  firebaseUrl: viteEnv.VITE_FIREBASE_URL || "",
  googleClientId: viteEnv.VITE_GOOGLE_CLIENT_ID || "",
  autoSync: String(viteEnv.VITE_AUTO_SYNC) !== "false", // default true
};

/** Check if any remote backend is pre-configured via env vars */
export function hasRemoteConfig(): boolean {
  return (
    (env.dbKind === "supabase" && env.supabaseUrl && env.supabaseAnonKey) ||
    (env.dbKind === "firebase" && env.firebaseUrl) ||
    env.dbKind === "bridge"
  );
}
