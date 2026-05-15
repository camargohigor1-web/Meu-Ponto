import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  });
}

