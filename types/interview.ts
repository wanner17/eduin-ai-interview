export type InterviewType = "general" | "pressure" | "pt";

export interface GeneratedQuestion {
  question: string;
  intent: string;
  keywords: string[];
  type: "technical" | "experience" | "personality";
}

export interface SessionQA {
  id: string;
  question: string;
  intent: string | null;
  keywords: string | null;
  answer: string | null;
  feedback: string | null;
  score: number | null;
}

export interface SessionData {
  id: string;
  status: string;
  startedAt: string | null;
  interviewerId: string;
  interviewType: InterviewType;
  qas: SessionQA[];
}
