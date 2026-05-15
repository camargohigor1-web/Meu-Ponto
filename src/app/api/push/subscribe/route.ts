import { NextResponse } from "next/server";
import webpush from "web-push";
import { configureWebPush, getPushStore } from "../_store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const status = configureWebPush();
  if (!status.ready) {
    return NextResponse.json({ error: "VAPID não configurado" }, { status: 400 });
  }

  const subscription = (await request.json()) as webpush.PushSubscription;
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  getPushStore().set(subscription.endpoint, subscription);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const subscription = (await request.json()) as Partial<webpush.PushSubscription>;
  if (subscription?.endpoint) {
    getPushStore().delete(subscription.endpoint);
  }
  return NextResponse.json({ ok: true });
}

