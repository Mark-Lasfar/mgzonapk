// /app/api/auth/session/route.ts

import { auth } from "@/auth"; // أو "@/lib/auth" حسب مكانك الفعلي
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  return NextResponse.json(session);
}
