import { NextResponse } from "next/server";
import webpush from "web-push";
import { configureWebPush, getPushStore } from "../_store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const status = configureWebPush();
  if (!status.ready) {
    return NextResponse.json({ error: "VAPID não configurado" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const payload = JSON.stringify({
    title: body.title || "MeuPonto",
    body: body.body || "Notificação de teste ativada.",
    url: "/",
  });

  const subscription = body.subscription as webpush.PushSubscription | undefined;
  const targets = subscription?.endpoint ? [subscription] : Array.from(getPushStore().values());
  const results = await Promise.allSettled(targets.map(target => webpush.sendNotification(target, payload)));

  return NextResponse.json({
    ok: results.some(result => result.status === "fulfilled"),
    sent: results.filter(result => result.status === "fulfilled").length,
    failed: results.filter(result => result.status === "rejected").length,
  });
}
