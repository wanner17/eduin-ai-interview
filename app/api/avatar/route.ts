import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getAudio } from "@/lib/audio-cache";
import { generateVideoWithMuseTalk } from "@/lib/ai/musetalk";

export async function POST(req: NextRequest) {
  const { audioId, questionText } = await req.json();

  if (!questionText) {
    return NextResponse.json({ error: "questionText 필수" }, { status: 400 });
  }

  const audioBuffer = audioId ? getAudio(audioId) : null;
  if (!audioBuffer) {
    return NextResponse.json({ videoUrl: null, error: "audio_not_found" });
  }

  try {
    const videoBuffer = await generateVideoWithMuseTalk(audioBuffer);

    const filename = `${randomUUID()}.mp4`;
    const videosDir = path.join(process.cwd(), "public", "videos");
    await mkdir(videosDir, { recursive: true });
    await writeFile(path.join(videosDir, filename), videoBuffer);

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    return NextResponse.json({ videoUrl: `${basePath}/videos/${filename}` });
  } catch {
    return NextResponse.json({ videoUrl: null, error: "musetalk_failed" });
  }
}
