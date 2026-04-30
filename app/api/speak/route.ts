import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/ai/tts";
import { storeAudio } from "@/lib/audio-cache";

export async function POST(req: NextRequest) {
  const { text, voice } = await req.json();
  if (!text) return NextResponse.json({ error: "text 필수" }, { status: 400 });

  try {
    const buffer = await synthesizeSpeech(text, voice);
    const audioId = storeAudio(buffer);
    return NextResponse.json({ audioId });
  } catch {
    return NextResponse.json({ audioId: null, error: "tts_failed" });
  }
}
