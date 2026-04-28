import OpenAI from "openai";
import type { GeneratedQuestion } from "@/types/interview";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QUESTION_SYSTEM_PROMPT = `당신은 10년 경력의 기술 면접관입니다.
이력서를 분석하여 면접 질문 5개를 생성하세요:
- 기술 질문 2개 (technical): 이력서의 기술 스택과 프로젝트 경험 기반
- 경험 질문 2개 (experience): 실제 업무/프로젝트 경험 관련
- 인성 질문 1개 (personality): 협업, 문제해결 방식 관련

반드시 아래 JSON 형식으로만 응답하세요:
{"questions":[{"question":"질문 내용","intent":"이 질문의 평가 목적","keywords":["핵심키워드1","핵심키워드2"],"type":"technical"}]}`;

export async function generateInterviewQuestions(
  resumeContent: string
): Promise<GeneratedQuestion[]> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: QUESTION_SYSTEM_PROMPT },
      { role: "user", content: `이력서:\n\n${resumeContent}` },
    ],
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("OpenAI 응답 없음");

  const { questions } = JSON.parse(content) as {
    questions: GeneratedQuestion[];
  };
  return questions;
}

const FEEDBACK_SYSTEM_PROMPT = `당신은 기술 면접관입니다. 지원자의 답변을 평가하세요.
평가 시 제공된 키워드 포함 여부, 답변의 구체성, 논리성을 기준으로 합니다.
반드시 아래 JSON 형식으로만 응답하세요:
{"feedback":"구체적인 피드백 (한국어, 2-3문장)","score":85}
score는 0-100 사이 정수입니다.`;

export async function generateFeedback(
  question: string,
  answer: string,
  keywordsJson: string | null
): Promise<{ feedback: string; score: number }> {
  const keywords: string[] = keywordsJson ? JSON.parse(keywordsJson) : [];

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: FEEDBACK_SYSTEM_PROMPT },
      {
        role: "user",
        content: `질문: ${question}\n평가 키워드: ${keywords.join(", ")}\n\n지원자 답변: ${answer}`,
      },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("OpenAI 피드백 응답 없음");

  return JSON.parse(content) as { feedback: string; score: number };
}
