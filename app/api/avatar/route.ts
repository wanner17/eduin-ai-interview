import { NextRequest, NextResponse } from "next/server";
import {
  createTalkWithAudio,
  createTalkWithText,
  pollTalk,
} from "@/lib/ai/did";

const PRESENTER_IMAGE_URL = process.env.DID_PRESENTER_IMAGE_URL ?? "";

export async function POST(req: NextRequest) {
  const { audioId, questionText } = await req.json();

  if (!questionText) {
    return NextResponse.json({ error: "questionText 필수" }, { status: 400 });
  }

  if (!process.env.DID_API_KEY) {
    return NextResponse.json({ videoUrl: null, error: "did_not_configured" });
  }

  try {
    let videoUrl: string | null = null;

    if (audioId && process.env.NEXT_PUBLIC_BASE_URL) {
      const audioUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/audio/${audioId}`;
      try {
        const talkId = await createTalkWithAudio(audioUrl, PRESENTER_IMAGE_URL);
        videoUrl = await pollTalk(talkId);
      } catch {
        // audio create or poll failed — fall through to text TTS
        const talkId = await createTalkWithText(questionText, PRESENTER_IMAGE_URL);
        videoUrl = await pollTalk(talkId);
      }
    } else {
      const talkId = await createTalkWithText(questionText, PRESENTER_IMAGE_URL);
      videoUrl = await pollTalk(talkId);
    }

    return NextResponse.json({ videoUrl });
  } catch {
    return NextResponse.json({ videoUrl: null, error: "did_failed" });
  }
}
