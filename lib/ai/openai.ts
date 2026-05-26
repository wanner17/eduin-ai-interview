import OpenAI from "openai";
import type { GeneratedQuestion, InterviewType } from "@/types/interview";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TYPE_STYLE: Record<InterviewType, string> = {
  general: `당신은 10년 경력의 기술 면접관입니다. 이력서를 분석하여 기술(technical), 경험(experience), 인성(personality) 영역을 균형 있게 배분한 면접 질문을 생성하세요.`,
  pressure: `당신은 압박 면접 전문 면접관입니다. 지원자를 날카롭게 평가하세요. 약점·모순을 파고드는 질문, 실패 경험을 구체적으로 묻는 질문, 가치관에 도전하는 질문을 포함하세요. 질문은 날카롭고 구체적이어야 하며, 단순한 답변을 허용하지 않는 형태로 작성하세요.`,
  pt: `당신은 PT 면접 전문 면접관입니다. 발표 내용의 논리적 구조 검증, 실현 가능성·근거 검토, 전달력·설득력 평가 질문을 포함하세요. 질문은 지원자가 발표한 내용을 심층적으로 검토하는 형태로 작성하세요.`,
};

function buildQuestionSystemPrompt(
  interviewType: InterviewType,
  count: number,
  jobRole?: string,
  focusKeywords?: string[]
): string {
  const lines: string[] = [TYPE_STYLE[interviewType]];
  if (jobRole) lines.push(`지원 직무: ${jobRole}`);
  if (focusKeywords?.length) lines.push(`중점 평가 영역: ${focusKeywords.join(", ")} — 이 영역 관련 질문을 우선적으로 포함하세요.`);
  lines.push(`\n면접 질문 ${count}개를 생성하세요.`);
  lines.push(`반드시 아래 JSON 형식으로만 응답하세요:\n{"questions":[{"question":"질문 내용","intent":"이 질문의 평가 목적","keywords":["핵심키워드1","핵심키워드2"],"type":"technical"}]}\ntype은 "technical", "experience", "personality" 중 하나입니다.`);
  return lines.join("\n");
}

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
  interviewType: InterviewType = "general",
  options: { jobRole?: string; focusKeywords?: string[]; questionCount?: number } = {}
): Promise<GeneratedQuestion[]> {
  const { jobRole, focusKeywords, questionCount = 5 } = options;
  const systemPrompt = buildQuestionSystemPrompt(interviewType, questionCount, jobRole, focusKeywords);
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: resumeContent
          ? `이력서:\n\n${resumeContent}`
          : "이력서가 제공되지 않았습니다. 지정된 직무와 평가 영역에 맞는 일반적인 면접 질문을 생성해 주세요.",
      },
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
