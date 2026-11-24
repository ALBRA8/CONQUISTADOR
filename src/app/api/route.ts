import { NextResponse } from "next/server";

// Health check de Pulso
export async function GET() {
  return NextResponse.json({ app: "pulso", ok: true, time: new Date().toISOString() });
}
