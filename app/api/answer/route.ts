import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/session-store";
import { generateFeedback } from "@/lib/ai/openai";

export async function POST(req: NextRequest) {
  const { qaId, answer, isLast } = await req.json();

  if (!qaId || !answer) {
    return NextResponse.json({ error: "qaId, answer 필수" }, { status: 400 });
  }

  const qa = sessionStore.getQA(qaId);
  if (!qa) {
    return NextResponse.json({ error: "QA not found" }, { status: 404 });
  }

  const { feedback, score } = await generateFeedback(qa.question, answer, qa.keywords);

  sessionStore.updateQA(qaId, { answer, feedback, score });

  if (isLast) {
    const session = sessionStore.completeSession(qa.sessionId);
    const allQAs = sessionStore.getSessionQAs(qa.sessionId);

    if (session.callbackUrl) {
      try {
        await fetch(session.callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            userId: session.userId,
            completedAt: session.endedAt,
            qas: allQAs.map(({ id, question, intent, answer, feedback, score }) => ({
              id,
              question,
              intent,
              answer,
              feedback,
              score,
            })),
          }),
        });
      } catch {
        // callback 실패해도 면접 완료 처리
      }
    }
  }

  return NextResponse.json({ feedback, score });
}
