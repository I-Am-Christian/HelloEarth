// Registers only the notification worker; no request interception or private-data caching.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/notification-sw.js", { scope: "/" }).catch(() => {});
  }, { once: true });
}
