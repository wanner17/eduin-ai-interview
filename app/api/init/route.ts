import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/session-store";
import { generateInterviewQuestions } from "@/lib/ai/openai";
import type { GeneratedQuestion } from "@/types/interview";

const DEFAULT_QUESTIONS: GeneratedQuestion[] = [
  {
    question: "간단하게 자기소개 부탁드립니다.",
    intent: "지원자의 배경과 강점 파악",
    keywords: ["경력", "강점", "지원동기"],
    type: "personality",
  },
  {
    question: "가장 어려웠던 기술적 문제와 해결 과정을 설명해 주세요.",
    intent: "문제 해결 능력 및 기술적 사고력 평가",
    keywords: ["문제정의", "분석", "해결"],
    type: "technical",
  },
  {
    question: "팀 프로젝트에서 갈등이 생겼을 때 어떻게 대처했나요?",
    intent: "협업 능력과 커뮤니케이션 방식 파악",
    keywords: ["협업", "소통", "갈등해결"],
    type: "experience",
  },
  {
    question: "최근 관심 갖고 있는 기술 트렌드는 무엇인가요?",
    intent: "학습 의지와 기술 트렌드 인식 평가",
    keywords: ["학습", "트렌드", "성장"],
    type: "technical",
  },
  {
    question: "5년 후 어떤 개발자가 되고 싶으신가요?",
    intent: "커리어 방향성과 목표의식 파악",
    keywords: ["목표", "성장방향", "비전"],
    type: "personality",
  },
];

export async function POST(req: NextRequest) {
  const { resumeContent, callbackUrl, interviewerId } = await req.json();

  const questions = resumeContent
    ? await generateInterviewQuestions(resumeContent)
    : DEFAULT_QUESTIONS;

  if (!questions?.length) {
    return NextResponse.json({ error: "질문 생성 실패" }, { status: 500 });
  }

  const { randomUUID } = await import("crypto");
  const session = sessionStore.createSession({
    userId: randomUUID(),
    callbackUrl: callbackUrl ?? null,
    interviewerId: interviewerId ?? "kim",
    questions: questions.map((q) => ({
      question: q.question,
      intent: q.intent,
      keywords: JSON.stringify(q.keywords),
    })),
  });

  return NextResponse.json({ sessionId: session.id });
}
