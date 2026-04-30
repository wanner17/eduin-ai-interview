import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function synthesizeSpeech(text: string, voice: string = "onyx"): Promise<Buffer> {
  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
    input: text,
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
