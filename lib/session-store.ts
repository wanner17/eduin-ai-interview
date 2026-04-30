import { randomUUID } from "crypto";
import type { InterviewType } from "@/types/interview";

interface QA {
  id: string;
  sessionId: string;
  question: string;
  intent: string | null;
  keywords: string | null;
  answer: string | null;
  feedback: string | null;
  score: number | null;
  _order: number;
}

interface Session {
  id: string;
  userId: string;
  callbackUrl: string | null;
  interviewerId: string;
  interviewType: InterviewType;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

const sessions = new Map<string, Session>();
const qas = new Map<string, QA>();

export const sessionStore = {
  createSession(data: {
    userId: string;
    callbackUrl: string | null;
    interviewerId: string;
    interviewType: InterviewType;
    questions: { question: string; intent: string; keywords: string }[];
  }) {
    const sessionId = randomUUID();
    const session: Session = {
      id: sessionId,
      userId: data.userId,
      callbackUrl: data.callbackUrl,
      interviewerId: data.interviewerId,
      interviewType: data.interviewType,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      endedAt: null,
      createdAt: new Date(),
    };
    sessions.set(sessionId, session);

    data.questions.forEach((q, i) => {
      const qaId = randomUUID();
      qas.set(qaId, {
        id: qaId,
        sessionId,
        question: q.question,
        intent: q.intent,
        keywords: q.keywords,
        answer: null,
        feedback: null,
        score: null,
        _order: i,
      });
    });

    return session;
  },

  getSession(id: string) {
    const session = sessions.get(id);
    if (!session) return null;
    const sessionQas = Array.from(qas.values())
      .filter((q) => q.sessionId === id)
      .sort((a, b) => a._order - b._order);
    return { ...session, qas: sessionQas };
  },

  getQA(id: string) {
    return qas.get(id) ?? null;
  },

  updateQA(id: string, data: { answer: string; feedback: string; score: number }) {
    const qa = qas.get(id);
    if (!qa) throw new Error("QA not found");
    const updated = { ...qa, ...data };
    qas.set(id, updated);
    return updated;
  },

  completeSession(id: string) {
    const session = sessions.get(id);
    if (!session) throw new Error("Session not found");
    const updated = { ...session, status: "COMPLETED", endedAt: new Date() };
    sessions.set(id, updated);
    return updated;
  },

  getSessionQAs(sessionId: string) {
    return Array.from(qas.values())
      .filter((q) => q.sessionId === sessionId)
      .sort((a, b) => a._order - b._order);
  },
};
