import type { PushReminder } from "@chrise/core";
import { getSupabase } from "./supabase";

const baseUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;

function vapidKey(): ArrayBuffer {
  const value = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!value) throw new Error("VITE_VAPID_PUBLIC_KEY não está configurada.");
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const result = new ArrayBuffer(bytes.length);
  new Uint8Array(result).set(bytes);
  return result;
}

export function isPushSupported() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export async function registerPushWorker() {
  if (!isPushSupported()) throw new Error("Este navegador não oferece Web Push.");
  return navigator.serviceWorker.register(new URL("sw.js", baseUrl()), { scope: baseUrl() });
}

export async function getPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await registerPushWorker();
  return registration.pushManager.getSubscription();
}

export async function enablePush() {
  if (!isPushSupported()) throw new Error("Este navegador não oferece Web Push.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "As notificações estão bloqueadas no navegador." : "Permissão para notificações não concedida.");

  const registration = await registerPushWorker();
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() });
  const { error } = await (await getSupabase()).functions.invoke("register-push", { body: subscription.toJSON() });
  if (error) {
    await subscription.unsubscribe();
    throw error;
  }
  return subscription;
}

export async function disablePush() {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await schedulePushReminders([]);
  const { error } = await (await getSupabase()).functions.invoke("register-push", {
    body: { endpoint: subscription.endpoint, action: "remove" },
  });
  if (error) throw error;
  await subscription.unsubscribe();
}

export async function schedulePushReminders(reminders: PushReminder[]) {
  const subscription = await getPushSubscription();
  if (!subscription) return false;
  const { error } = await (await getSupabase()).functions.invoke("schedule-push", { body: { reminders } });
  if (error) throw error;
  return true;
}
