import { NextResponse } from "next/server";

export async function POST() {
  const res = await fetch("https://api.simli.ai/compose/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-simli-api-key": process.env.SIMLI_API_KEY ?? "",
    },
    body: JSON.stringify({
      faceId: process.env.SIMLI_FACE_ID,
      apiVersion: "v2",
      maxSessionLength: 600,
      maxIdleTime: 60,
      handleSilence: false,
    }),
  });

  if (!res.ok) return NextResponse.json({ error: "simli_token_failed" }, { status: 500 });
  const data = await res.json();
  return NextResponse.json({ session_token: data.session_token });
}
