"use client";

import { use, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { SessionData } from "@/types/interview";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score > 0 ? "#ef4444" : "#d1d5db";
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg width="144" height="144" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-4xl font-black text-gray-900">{score}</span>
        <span className="text-xs text-gray-400 mt-1 font-medium">/ 100</span>
      </div>
    </div>
  );
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const mentorInitialized = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/session/${sessionId}`)
      .then((r) => r.json())
      .then((data: SessionData) => { setSession(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (!session || mentorInitialized.current) return;
    mentorInitialized.current = true;
    setChatLoading(true);
    fetch(`${basePath}/api/mentor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, messages: [] }),
    })
      .then((r) => r.json())
      .then(({ reply }: { reply: string }) => setChatMessages([{ role: "assistant", content: reply }]))
      .catch(() => setChatMessages([{ role: "assistant", content: "멘토 연결에 실패했습니다. 질문을 입력해 다시 시도해주세요." }]))
      .finally(() => setChatLoading(false));
  }, [session, sessionId, basePath]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch(`${basePath}/api/mentor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages: updated }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { reply } = (await res.json()) as { reply: string };
      setChatMessages([...updated, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages([...updated, { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-gray-900 gap-4">
        <Spinner />
        <p className="text-gray-500">결과를 불러오는 중...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-gray-900">
        <p className="text-red-500">결과를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const scoredQAs = session.qas.filter((qa) => qa.score !== null);
  const overallScore = scoredQAs.length > 0
    ? Math.round(scoredQAs.reduce((sum, qa) => sum + (qa.score ?? 0), 0) / scoredQAs.length)
    : 0;
  const gradeLabel = overallScore >= 90 ? "최우수" : overallScore >= 80 ? "우수" : overallScore >= 60 ? "보통" : overallScore >= 40 ? "미흡" : "노력 필요";
  const gradeColor = overallScore >= 80 ? "text-green-600 bg-green-50 border-green-200"
    : overallScore >= 60 ? "text-yellow-600 bg-yellow-50 border-yellow-200"
    : "text-red-600 bg-red-50 border-red-200";

  return (
    <main className="min-h-screen w-full bg-white text-gray-900">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <p className="text-blue-500 text-xs font-bold tracking-[0.2em] uppercase mb-3">Interview Result</p>
          <h1 className="text-4xl font-black text-gray-900">면접 결과</h1>
        </motion.header>

        {/* Overall Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gray-50 border border-gray-200 rounded-3xl p-8 mb-6"
        >
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <ScoreRing score={overallScore} />
            <div className="text-center sm:text-left">
              <p className="text-gray-400 text-sm mb-1">총 {session.qas.length}개 질문 · 평균 점수</p>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">종합 평가</h2>
              <span className={`inline-block text-sm font-bold px-4 py-1.5 rounded-full border ${gradeColor}`}>
                {gradeLabel}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Q&A Cards */}
        <div className="space-y-3 mb-8">
          {session.qas.map((qa, i) => {
            const keywords: string[] = qa.keywords
              ? (() => { try { return JSON.parse(qa.keywords); } catch { return []; } })()
              : [];
            const score = qa.score ?? null;
            const scoreText = score === null ? "text-gray-400" : score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500";
            const barBg = score === null ? "bg-gray-200" : score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";
            const badgeBorder = score === null ? "border-gray-200" : score >= 80 ? "border-green-200" : score >= 60 ? "border-yellow-200" : "border-red-200";

            return (
              <motion.div
                key={qa.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-bold text-blue-500 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                        Q{i + 1}
                      </span>
                      {qa.intent && (
                        <span className="text-xs text-gray-400 truncate">{qa.intent}</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-800 leading-snug">{qa.question}</p>
                  </div>

                  {/* Score badge */}
                  <div className={`shrink-0 flex items-baseline gap-1 bg-gray-50 border ${badgeBorder} rounded-xl px-4 py-2.5`}>
                    <span className={`text-3xl font-black tabular-nums ${scoreText}`}>
                      {score !== null ? score : "—"}
                    </span>
                    <span className="text-gray-400 text-sm font-semibold ml-0.5">/ 100</span>
                  </div>
                </div>

                {/* Score bar */}
                <div className="px-5 pb-4">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: score !== null ? `${score}%` : "0%" }}
                      transition={{ duration: 0.9, delay: 0.3 + i * 0.07, ease: "easeOut" }}
                      className={`h-full rounded-full ${barBg}`}
                    />
                  </div>
                </div>

                {/* Keywords */}
                {keywords.length > 0 && (
                  <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                    {keywords.map((kw) => (
                      <span key={kw} className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* My answer */}
                {qa.answer && (
                  <div className="mx-5 mb-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-400 font-semibold mb-1.5">내 답변</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{qa.answer}</p>
                  </div>
                )}

                {/* AI feedback */}
                {qa.feedback && (
                  <div className="mx-5 mb-5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <p className="text-xs text-blue-500 font-semibold">AI 피드백</p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{qa.feedback}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Q&A Review */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6 shadow-sm"
        >
          <div className="px-5 py-4 border-b border-gray-200">
            <p className="text-sm font-bold text-gray-900">면접 기록</p>
            <p className="text-xs text-gray-400 mt-0.5">질문과 내 답변 전체 보기</p>
          </div>
          <div className="divide-y divide-gray-100">
            {session.qas.map((qa, i) => (
              <div key={qa.id} className="px-5 py-4">
                <p className="text-xs font-bold text-blue-500 mb-1">Q{i + 1}</p>
                <p className="text-sm font-semibold text-gray-800 mb-2 leading-snug">{qa.question}</p>
                {qa.answer ? (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{qa.answer}</p>
                ) : (
                  <p className="text-sm text-gray-300 italic">답변 없음</p>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        {/* AI Mentor */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8 shadow-sm"
        >
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-sm shrink-0">
              🤖
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">AI 취업멘토</p>
              <p className="text-xs text-gray-400">면접 코치 + 커리어 코치</p>
            </div>
          </div>

          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-500 flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  <span>면접 결과 분석 중...</span>
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-700 rounded-bl-sm"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMessages.length > 0 && chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-500 flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  <span>답변 생성 중...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-gray-200 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="멘토에게 질문하세요..."
              disabled={chatLoading}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={chatLoading || !chatInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
            >
              전송
            </button>
          </div>
        </motion.section>

        <footer className="text-center">
          <button
            onClick={() => router.push("/")}
            className="px-8 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-gray-300 font-semibold transition-all text-gray-700 text-sm"
          >
            ← 메인으로 돌아가기
          </button>
        </footer>
      </div>
    </main>
  );
}

function Spinner(props: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-8 w-8 text-blue-500 ${props.className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
