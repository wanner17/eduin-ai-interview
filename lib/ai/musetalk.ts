const MUSETALK_API_URL = process.env.MUSETALK_API_URL ?? "http://192.168.0.253:8002";

export async function generateVideoWithMuseTalk(
  audioBuffer: Buffer
): Promise<Buffer> {
  const formData = new FormData();
  formData.append("audio", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");

  const res = await fetch(`${MUSETALK_API_URL}/generate`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`MuseTalk failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
