import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

export const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  }
});

export function redirectToLogin() {
  window.location.replace("login.html?next=dashboard.html");
}

export async function requireUser() {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) {
    redirectToLogin();
    return null;
  }
  return user;
}

export function statusMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", isError);
  element.classList.toggle("is-success", !isError && Boolean(message));
}
