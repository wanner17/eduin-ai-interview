import { NextRequest, NextResponse } from "next/server";
import WebSocket from "ws";

export const runtime = "nodejs";

const WS_URL = process.env.MUSETALK_WS_URL!;
const API_KEY = process.env.MUSETALK_API_KEY!;

export async function POST(req: NextRequest) {
  const interviewerId = req.nextUrl.searchParams.get("interviewer_id") ?? "1";
  const audioData = Buffer.from(await req.arrayBuffer());

  try {
    const frames = await inferFrames(interviewerId, audioData);
    return NextResponse.json({ frames, fps: 25 });
  } catch (err) {
    console.error("[musetalk] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function inferFrames(interviewerId: string, audioData: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = `${WS_URL}?interviewer_id=${interviewerId}`;
    const ws = new WebSocket(url, { rejectUnauthorized: false });
    const frames: string[] = [];

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error("MuseTalk timeout"));
    }, 120_000);

    ws.on("open", () => {
      ws.send(API_KEY);
    });

    ws.on("message", (raw) => {
      const data = JSON.parse(raw.toString()) as {
        status?: string;
        type?: string;
        frame?: string;
        error?: string;
        total?: number;
      };

      if (data.error) {
        clearTimeout(timeout);
        ws.terminate();
        reject(new Error(data.error));
      } else if (data.status === "ready") {
        ws.send(audioData);
      } else if (data.type === "frame" && data.frame) {
        frames.push(data.frame);
      } else if (data.type === "done") {
        clearTimeout(timeout);
        ws.close();
        resolve(frames);
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
