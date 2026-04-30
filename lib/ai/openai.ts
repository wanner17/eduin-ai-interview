import OpenAI from "openai";
import type { GeneratedQuestion, InterviewType } from "@/types/interview";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QUESTION_PROMPTS: Record<InterviewType, string> = {
  general: `당신은 10년 경력의 기술 면접관입니다.
이력서를 분석하여 면접 질문 5개를 생성하세요:
- 기술 질문 2개 (technical): 이력서의 기술 스택과 프로젝트 경험 기반
- 경험 질문 2개 (experience): 실제 업무/프로젝트 경험 관련
- 인성 질문 1개 (personality): 협업, 문제해결 방식 관련

반드시 아래 JSON 형식으로만 응답하세요:
{"questions":[{"question":"질문 내용","intent":"이 질문의 평가 목적","keywords":["핵심키워드1","핵심키워드2"],"type":"technical"}]}`,

  pressure: `당신은 압박 면접 전문 면접관입니다. 지원자를 날카롭게 평가하세요.
이력서를 분석하여 압박 면접 질문 5개를 생성하세요:
- 지원자의 약점이나 모순을 파고드는 질문 2개 (technical)
- 예상치 못한 상황 대처나 실패 경험을 구체적으로 파고드는 질문 2개 (experience)
- 지원자의 가치관이나 판단력에 도전하는 질문 1개 (personality)

질문은 날카롭고 구체적이어야 하며, 단순한 답변을 허용하지 않는 형태로 작성하세요.
반드시 아래 JSON 형식으로만 응답하세요:
{"questions":[{"question":"질문 내용","intent":"이 질문의 평가 목적","keywords":["핵심키워드1","핵심키워드2"],"type":"technical"}]}`,

  pt: `당신은 PT 면접 전문 면접관입니다.
이력서를 분석하여 발표 면접 질문 5개를 생성하세요:
- 발표 주제나 내용의 논리적 구조를 검증하는 질문 2개 (technical)
- 발표 내용의 실현 가능성이나 근거를 파고드는 질문 2개 (experience)
- 발표자의 전달력과 설득력을 평가하는 질문 1개 (personality)

질문은 지원자가 발표한 내용에 대해 심층적으로 검토하는 형태로 작성하세요.
반드시 아래 JSON 형식으로만 응답하세요:
{"questions":[{"question":"질문 내용","intent":"이 질문의 평가 목적","keywords":["핵심키워드1","핵심키워드2"],"type":"technical"}]}`,
};

const FEEDBACK_PROMPTS: Record<InterviewType, string> = {
  general: `당신은 기술 면접관입니다. 지원자의 답변을 평가하세요.
평가 시 제공된 키워드 포함 여부, 답변의 구체성, 논리성을 기준으로 합니다.
반드시 아래 JSON 형식으로만 응답하세요:
{"feedback":"구체적인 피드백 (한국어, 2-3문장)","score":85}
score는 0-100 사이 정수입니다.`,

  pressure: `당신은 압박 면접 전문 면접관입니다. 지원자의 답변을 엄격하게 평가하세요.
답변의 논리적 허점, 불명확한 부분, 구체성 부족을 날카롭게 지적하세요.
좋은 점은 간략히 인정하되, 개선이 필요한 부분을 직접적으로 비판하세요.
반드시 아래 JSON 형식으로만 응답하세요:
{"feedback":"엄격하고 비판적인 피드백 (한국어, 2-3문장)","score":85}
score는 0-100 사이 정수이며, 평균보다 엄격하게 채점하세요.`,

  pt: `당신은 PT 면접 전문 면접관입니다. 지원자의 발표 답변을 평가하세요.
논리적 구조, 근거의 타당성, 전달력, 설득력을 기준으로 평가하세요.
반드시 아래 JSON 형식으로만 응답하세요:
{"feedback":"발표 관점의 구체적인 피드백 (한국어, 2-3문장)","score":85}
score는 0-100 사이 정수입니다.`,
};

export async function generateInterviewQuestions(
  resumeContent: string,
  interviewType: InterviewType = "general"
): Promise<GeneratedQuestion[]> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: QUESTION_PROMPTS[interviewType] },
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

export async function generateFeedback(
  question: string,
  answer: string,
  keywordsJson: string | null,
  interviewType: InterviewType = "general"
): Promise<{ feedback: string; score: number }> {
  const keywords: string[] = keywordsJson ? JSON.parse(keywordsJson) : [];

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: FEEDBACK_PROMPTS[interviewType] },
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
