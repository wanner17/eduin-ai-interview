import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const SERVER_URL = process.env.MUSETALK_SERVER_URL!;
const API_KEY = process.env.MUSETALK_API_KEY!;

export async function POST(req: NextRequest) {
  const { imageUrl, avatarId } = (await req.json()) as {
    imageUrl: string;
    avatarId: string;
  };

  try {
    const imagePath = path.join(process.cwd(), "public", imageUrl);
    const imageData = await fs.readFile(imagePath);

    const res = await fetch(`${SERVER_URL}/prepare?avatar_id=${avatarId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-api-key": API_KEY,
      },
      body: imageData,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[musetalk-prepare] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
