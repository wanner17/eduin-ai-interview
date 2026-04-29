import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: "onyx",
    input: text,
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
