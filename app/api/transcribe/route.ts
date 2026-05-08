import { SpeechClient } from "@google-cloud/speech";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const client = new SpeechClient(
  process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? {}
    : { keyFilename: path.join(process.cwd(), "google-stt-key.json") }
);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get("audio") as Blob | null;
  const mimeType = (formData.get("mimeType") as string) ?? "audio/webm;codecs=opus";

  if (!audio || audio.size === 0) {
    return NextResponse.json({ transcript: "" });
  }

  const audioBuffer = Buffer.from(await audio.arrayBuffer());
  const encoding = mimeType.includes("ogg") ? "OGG_OPUS" : "WEBM_OPUS";

  const [response] = await client.recognize({
    audio: { content: audioBuffer.toString("base64") },
    config: {
      encoding,
      sampleRateHertz: 48000,
      languageCode: "ko-KR",
      model: "latest_long",
      enableAutomaticPunctuation: true,
      speechContexts: [
        {
          phrases: [
            "백엔드", "프론트엔드", "풀스택", "데이터베이스", "API",
            "마이크로서비스", "CI/CD", "쿠버네티스", "도커", "클라우드",
            "리팩토링", "코드리뷰", "애자일", "스크럼", "스프린트",
            "알고리즘", "자료구조", "객체지향", "함수형", "비동기",
            "TypeScript", "JavaScript", "React", "Next.js", "Node.js",
          ],
          boost: 15,
        },
      ],
    },
  });

  const transcript =
    response.results
      ?.map((r) => r.alternatives?.[0]?.transcript ?? "")
      .join(" ")
      .trim() ?? "";

  return NextResponse.json({ transcript });
}
