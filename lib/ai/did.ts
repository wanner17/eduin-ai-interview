const DID_API_URL = "https://api.d-id.com";

function authHeader(): string {
  const key = process.env.DID_API_KEY ?? "";
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function postTalk(body: object): Promise<string> {
  const res = await fetch(`${DID_API_URL}/talks`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`D-ID createTalk failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export function createTalkWithAudio(
  audioUrl: string,
  presenterImageUrl: string
): Promise<string> {
  return postTalk({
    source_url: presenterImageUrl,
    script: { type: "audio", audio_url: audioUrl },
  });
}

export function createTalkWithText(
  text: string,
  presenterImageUrl: string
): Promise<string> {
  return postTalk({
    source_url: presenterImageUrl,
    script: {
      type: "text",
      input: text,
      provider: { type: "microsoft", voice_id: "ko-KR-InJoonNeural" },
    },
  });
}

export async function pollTalk(talkId: string): Promise<string> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${DID_API_URL}/talks/${talkId}`, {
      headers: { Authorization: authHeader() },
    });
    if (!res.ok) throw new Error(`D-ID pollTalk failed: ${res.status}`);
    const data = (await res.json()) as { status: string; result_url?: string };
    if (data.status === "done" && data.result_url) return data.result_url;
    if (data.status === "error") throw new Error("D-ID talk generation error");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("D-ID pollTalk timeout (60s)");
}
