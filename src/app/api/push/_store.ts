import webpush from "web-push";

type StoredSubscription = webpush.PushSubscription;

const globalStore = globalThis as typeof globalThis & {
  __meuPontoPushSubscriptions?: Map<string, StoredSubscription>;
};

export function getPushStore() {
  if (!globalStore.__meuPontoPushSubscriptions) {
    globalStore.__meuPontoPushSubscriptions = new Map();
  }
  return globalStore.__meuPontoPushSubscriptions;
}

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@meuponto.local";

  if (!publicKey || !privateKey) {
    return { ready: false as const, publicKey };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { ready: true as const, publicKey };
}

