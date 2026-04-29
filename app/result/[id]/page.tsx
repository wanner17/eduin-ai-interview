"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { SessionData } from "@/types/interview";

export default function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/session/${sessionId}`)
      .then((r) => r.json())
      .then((data: SessionData) => {
        setSession(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-4">
        <Spinner />
        <p className="text-gray-400">결과를 불러오는 중...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p className="text-red-400">결과를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const scoredQAs = session.qas.filter((qa) => qa.score !== null);
  const overallScore =
    scoredQAs.length > 0
      ? Math.round(
          scoredQAs.reduce((sum, qa) => sum + (qa.score ?? 0), 0) / scoredQAs.length
        )
      : 0;

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-gray-950 to-black text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-300 to-blue-500 bg-clip-text text-transparent mb-2">
            결과
          </h1>
          {/* <p className="text-gray-500 text-sm font-mono">Session ID: {sessionId}</p> */}
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 mb-10 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="text-center sm:text-left">
            <p className="text-gray-400 text-sm">총 {session.qas.length}개 질문에 대한 평균 점수</p>
            <p className="text-lg font-semibold text-white">종합 평가</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-bold text-blue-400">{overallScore}</span>
            <span className="text-2xl font-medium text-gray-500">/ 100</span>
          </div>
        </motion.div>

        <div className="space-y-4">
          {session.qas.map((qa, i) => {
            const keywords: string[] = qa.keywords ? (() => { try { return JSON.parse(qa.keywords); } catch { return []; } })() : [];
            const scoreColor = qa.score === null ? "text-gray-500" : qa.score >= 80 ? "text-green-400" : qa.score >= 60 ? "text-yellow-400" : "text-red-400";
            const barColor = qa.score === null ? "bg-gray-600" : qa.score >= 80 ? "bg-green-500" : qa.score >= 60 ? "bg-yellow-500" : "bg-red-500";
            return (
              <motion.div
                key={qa.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Q{i + 1}</span>
                    <p className="font-semibold text-gray-200 mt-1">{qa.question}</p>
                    {qa.intent && (
                      <p className="text-xs text-gray-500 mt-1">평가 의도: {qa.intent}</p>
                    )}
                  </div>
                  {qa.score !== null && (
                    <div className="text-right shrink-0">
                      <span className={`text-3xl font-bold ${scoreColor}`}>{qa.score}</span>
                      <span className="text-gray-500 text-sm"> / 100</span>
                    </div>
                  )}
                </div>

                {qa.score !== null && (
                  <div className="space-y-1">
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${qa.score}%` }}
                      />
                    </div>
                  </div>
                )}

                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw) => (
                      <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-800 text-blue-300">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {qa.answer && (
                  <div className="pl-4 border-l-2 border-gray-700">
                    <p className="text-xs text-gray-500 mb-1 font-semibold">내 답변</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{qa.answer}</p>
                  </div>
                )}

                {qa.feedback && (
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-xs text-green-400 mb-1 font-semibold">AI 피드백</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{qa.feedback}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <footer className="text-center mt-12">
          <button
            onClick={() => router.push("/")}
            className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40"
          >
            메인으로 돌아가기
          </button>
        </footer>
      </div>
    </main>
  );
}

function Spinner(props: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-8 w-8 text-blue-400 ${props.className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
