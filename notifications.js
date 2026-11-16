import { db } from "./supabase-client.js";

const $ = id => document.getElementById(id);
const enableButton = $("notifications-enable");
const disableButton = $("notifications-disable");
const testButton = $("notifications-test");
const statusNode = $("notifications-status");
const state = { userId: null, enabled: false, busy: false, subscription: null, week: null, syncId: 0 };
const key = userId => "helloearth-push-consent:" + userId;
const supported = () => "serviceWorker" in navigator &&
  "PushManager" in window && "Notification" in window && "crypto" in window &&
  Boolean(crypto.subtle) && location.protocol === "https:";
const isIos = () => /iPad|iPhone|iPod/i.test(navigator.userAgent);
const installed = () => window.matchMedia("(display-mode: standalone)").matches ||
  Boolean(navigator.standalone);
function status(message, error = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", error);
}
function busy(value) {
  state.busy = value;
  for (const button of [enableButton, disableButton, testButton]) button.disabled = value;
}
function render() {
  const yes = state.enabled && Notification.permission === "granted";
  enableButton.hidden = yes;
  disableButton.hidden = !yes;
  testButton.hidden = !yes;
  if (state.busy) busy(true);
}
function encodedPublicKey(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(bytes, c => c.charCodeAt(0));
}
async function api(body) {
  const { data, error } = await db.functions.invoke("helloearth-notifications", { body });
  if (error) {
    let reason = "Notification service unavailable.";
    try { const details = await error.context?.json?.(); if (details?.error) reason = details.error; } catch {}
    throw new Error(reason);
  }
  return data;
}
async function worker() {
  return navigator.serviceWorker.register("/notification-sw.js", { scope: "/" });
}
async function currentUser() {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return null;
  return user;
}
async function hashEvent(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function syncWeek(week) {
  if (!state.enabled || !state.userId || !week?.connected || !state.subscription) return;
  const requestId = ++state.syncId;
  const start = Date.parse(week.windowStart), end = Date.parse(week.windowEnd), now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) ||
      start < now - 8 * 86400000 || end > now + 16 * 86400000) {
    status("Reminders are queued for the current and nearby upcoming weeks. Select a more recent calendar week.");
    return;
  }
  const events = Array.isArray(week.events) ? week.events : [];
  const dedup = new Set(), batch = [];
  for (const entry of events) {
    if (!entry.id || !entry.calendarId || !entry.start?.dateTime) continue; // no all-day notifications
    const time = new Date(entry.start.dateTime);
    if (!Number.isFinite(time.getTime())) continue;
    const eventKey = await hashEvent(entry.calendarId + ":" + entry.id);
    if (dedup.has(eventKey)) continue;
    dedup.add(eventKey);
    batch.push({ key: eventKey, startsAt: time.toISOString() });
  }
  if (requestId !== state.syncId || !state.enabled) return;
  try {
    const result = await api({ action: "sync-reminders", windowStart: week.windowStart,
      windowEnd: week.windowEnd, events: batch.slice(0, 80) });
    if (requestId !== state.syncId || !state.enabled) return;
    const count = Number(result?.scheduled ?? 0);
    status("Reminders active. " + count + " upcoming timed appointment" +
      (count === 1 ? "" : "s") + " queued from the displayed calendar week.");
  } catch (error) {
    if (requestId === state.syncId) status("Notifications enabled, but calendar reminders could not be queued: " + error.message, true);
  }
}
enableButton.addEventListener("click", async () => {
  if (!supported()) {
    status(isIos() ? "On iPhone, add HelloEarth to your Home Screen and open it from the icon first." :
      "This browser does not support web push notifications.", true);
    return;
  }
  // The permission request must start directly from this user click (especially on iOS).
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    status("Permission not granted. Check HelloEarth's notification permissions in your device settings.", true);
    return;
  }
  busy(true);
  try {
    const user = await currentUser();
    if (!user) throw new Error("Sign in first.");
    state.userId = user.id;
    const registration = await worker();
    const { publicKey } = await api({ action: "public-key" });
    if (!publicKey) throw new Error("Server push key missing.");
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, applicationServerKey: encodedPublicKey(publicKey)
    });
    await api({ action: "subscribe", subscription: subscription.toJSON() });
    state.subscription = subscription;
    state.enabled = true;
    localStorage.setItem(key(user.id), "1");
    render();
    status("Notifications enabled on this device. Connect Google Calendar to queue lesson reminders.");
    if (state.week) await syncWeek(state.week);
  } catch (error) { status(error.message || "Could not enable notifications.", true); }
  finally { busy(false); }
});
async function disableNotifications() {
  state.syncId++;
  try {
    const sub = state.subscription || (supported() ? await (await worker()).pushManager.getSubscription() : null);
    if (state.userId) {
      await api({ action: "unsubscribe", endpoint: sub?.endpoint || "", clearReminders: true });
      localStorage.removeItem(key(state.userId));
    }
    if (sub) await sub.unsubscribe();
    state.subscription = null;
    state.enabled = false;
    render();
    status("Notifications and pending reminders disabled on this device.");
  } catch (error) { status("Unable to turn off reminders: " + error.message, true); }
}
disableButton.addEventListener("click", async () => {
  busy(true);
  try { await disableNotifications(); } finally { busy(false); }
});
testButton.addEventListener("click", async () => {
  busy(true);
  try {
    if (!state.subscription) throw new Error("Enable notifications first.");
    await api({ action: "test", endpoint: state.subscription.endpoint });
    status("Test notification sent. Check this device's notification centre.");
  } catch (error) { status(error.message || "Test failed.", true); }
  finally { busy(false); }
});
document.addEventListener("helloearth:calendar-events", event => {
  state.week = event.detail;
  if (state.enabled) syncWeek(state.week);
});
document.addEventListener("helloearth:calendar-disconnected", () => { state.week = null; });
async function initialize() {
  if (!supported()) {
    enableButton.disabled = true;
    status(isIos() && !installed()
      ? "Install HelloEarth to your iPhone Home Screen, then open it from the icon to enable notifications."
      : "Push notifications are not supported in this browser.", true);
    return;
  }
  if (isIos() && !installed()) {
    enableButton.disabled = true;
    status("On iPhone, first install HelloEarth to your Home Screen and launch it from there.");
    return;
  }
  try {
    const user = await currentUser();
    if (!user) return;
    state.userId = user.id;
    if (localStorage.getItem(key(user.id)) !== "1") {
      status("Off. Enable notifications to receive private appointment reminders.");
      return;
    }
    if (Notification.permission !== "granted") {
      localStorage.removeItem(key(user.id));
      status("Notification access needs permission again. Tap Enable notifications.");
      return;
    }
    const reg = await worker();
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      localStorage.removeItem(key(user.id));
      status("Notification subscription expired. Tap Enable notifications again.");
      return;
    }
    await api({ action: "subscribe", subscription: subscription.toJSON() });
    state.subscription = subscription;
    state.enabled = true;
    render();
    status("Notifications enabled. Calendar reminders will be refreshed when the week loads.");
    if (state.week) await syncWeek(state.week);
  } catch (error) { status("Unable to restore notifications: " + (error.message || "try again"), true); }
}
window.HelloEarthNotifications = {
  async signout() {
    if (!state.userId || !state.enabled) return;
    try { await disableNotifications(); }
    catch { try { await state.subscription?.unsubscribe(); } catch {} }
  }
};
db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    state.syncId++;
    state.enabled = false;
    state.subscription?.unsubscribe().catch(() => {});
    state.subscription = null;
    render();
  }
});
initialize();
