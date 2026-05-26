"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { INTERVIEWERS } from "@/lib/interviewers";
import type { InterviewType } from "@/types/interview";
import { JobSelector } from "@/components/JobSelector";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const INTERVIEW_TYPES: { id: InterviewType; label: string; description: string }[] = [
  { id: "general", label: "일반면접", description: "기술·경험·인성 균형" },
  { id: "pressure", label: "압박면접", description: "날카로운 질문·엄격한 평가" },
  { id: "pt", label: "PT면접", description: "발표 기반 심층 질문" },
];

const PT_RANDOM_TOPICS = [
  "주제: AI 기반 추천 시스템 설계\n내용: 사용자 행동 데이터를 활용한 콘텐츠 추천 알고리즘 설계 및 실시간 성능 최적화 방안 제안",
  "주제: 마이크로서비스 전환 전략\n내용: 모놀리식 아키텍처에서 MSA로의 단계적 전환 계획, 서비스 분리 기준, 데이터 정합성 유지 방안",
  "주제: 대용량 트래픽 처리 아키텍처\n내용: 초당 10만 요청을 처리하는 시스템 설계 — 캐싱, 로드밸런싱, 수평 확장 전략",
  "주제: DevOps 파이프라인 구축 제안\n내용: CI/CD 자동화, 컨테이너 오케스트레이션, 모니터링 체계 수립을 통한 배포 안정성 향상",
  "주제: 레거시 시스템 현대화 방안\n내용: 10년된 레거시 코드베이스를 최신 기술 스택으로 점진적으로 마이그레이션하는 전략",
  "주제: 실시간 데이터 파이프라인 설계\n내용: Kafka 기반 이벤트 스트리밍으로 데이터 지연을 최소화하는 ETL 파이프라인 구축 방안",
  "주제: 보안 취약점 개선 계획\n내용: OWASP Top 10 기반 취약점 분석 결과와 우선순위별 보안 강화 로드맵 제시",
  "주제: 모바일 앱 성능 최적화\n내용: 앱 초기 로딩 시간 3초 → 1초 단축을 위한 번들 최적화, 지연 로딩, 캐싱 전략",
];


const FOCUS_KEYWORDS = [
  "문제해결능력", "커뮤니케이션", "리더십", "협업/팀워크",
  "프로젝트 경험", "성과/실적", "전문기술/지식", "데이터 분석",
  "전략적 사고", "성장/학습", "위기대처", "창의성/혁신",
];

const QUESTION_COUNTS = [3, 5, 7, 10];

export default function HomePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedInterviewerId, setSelectedInterviewerId] = useState<string | null>(null);
  const [isRandom, setIsRandom] = useState(false);
  const [selectedInterviewType, setSelectedInterviewType] = useState<InterviewType | null>(null);
  const [ptContent, setPtContent] = useState("");
  const [ptMode, setPtMode] = useState<"file" | "type" | "random">("type");
  const [ptFileName, setPtFileName] = useState("");
  const ptFileRef = useRef<HTMLInputElement>(null);
  const [selectedJobRole, setSelectedJobRole] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(5);

  const selectInterviewer = (id: string) => {
    if (!isRandom && selectedInterviewerId === id) {
      setSelectedInterviewerId(null); // 같은 카드 클릭 시 선택 취소
    } else {
      setSelectedInterviewerId(id);
      setIsRandom(false);
    }
  };

  const toggleRandom = () => {
    if (isRandom) {
      setIsRandom(false);
      setSelectedInterviewerId(null);
    } else {
      const idx = Math.floor(Math.random() * INTERVIEWERS.length);
      setSelectedInterviewerId(INTERVIEWERS[idx].id);
      setIsRandom(true);
    }
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    try {
      const text = await file.text();
      setResumeText(text);
    } catch {
      setError("파일을 읽는 중 오류가 발생했습니다.");
      setFileName("");
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleStart = async () => {
    if (!selectedInterviewerId || !selectedInterviewType) return;
    setIsLoading(true);
    setError("");
    try {
      const resumeContent =
        selectedInterviewType === "pt" ? ptContent || null : resumeText || null;

      const res = await fetch(`${BASE_PATH}/api/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeContent,
          callbackUrl: null,
          interviewerId: selectedInterviewerId,
          interviewType: selectedInterviewType,
          jobRole: selectedJobRole ?? undefined,
          focusKeywords: selectedKeywords.length > 0 ? selectedKeywords : undefined,
          questionCount,
        }),
      });
      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: "서버와 통신 중 오류가 발생했습니다." }));
        throw new Error(errorData.message || "면접 세션 생성에 실패했습니다.");
      }
      const { sessionId } = await res.json();
      router.push(`/${sessionId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "알 수 없는 오류가 발생했습니다. 다시 시도해 주세요."
      );
      setIsLoading(false);
    }
  };

  const isPt = selectedInterviewType === "pt";
  const isPtContentMissing = isPt && ptContent.trim() === "";
  const hasSelection =
    selectedInterviewerId !== null &&
    selectedInterviewType !== null &&
    !isPtContentMissing;

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-gray-950 to-black flex items-center justify-center text-white p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-300 to-blue-500 bg-clip-text text-transparent">
            이력서를 업로드하고,<br />맞춤형 면접을 경험해보세요.
          </h1>
        </div>

        {/* 면접관 선택 */}
        <div className="space-y-3 text-left">
          <p className="text-sm font-medium text-gray-500">면접관 선택</p>

          {/* 면접관 카드 */}
          <div className="grid grid-cols-3 gap-3">
            {INTERVIEWERS.map((interviewer) => {
              const isSelected = !isRandom && selectedInterviewerId === interviewer.id;
              return (
                <button
                  key={interviewer.id}
                  onClick={() => selectInterviewer(interviewer.id)}
                  disabled={isLoading}
                  className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all duration-200 disabled:cursor-not-allowed ${
                    isSelected
                      ? "border-blue-500 shadow-lg shadow-blue-500/30"
                      : isRandom
                        ? "border-gray-800 opacity-40 cursor-not-allowed"
                        : "border-gray-700 hover:border-gray-400"
                  }`}
                >
                  {isRandom ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-4xl text-gray-500">?</div>
                  ) : (
                    <img
                      src={`${BASE_PATH}${interviewer.imageUrl}`}
                      alt={interviewer.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {isSelected && (
                    <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 shadow">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 랜덤 선택 버튼 */}
          <button
            onClick={toggleRandom}
            disabled={isLoading}
            className={`w-full py-3 rounded-xl border-2 transition-all duration-200 flex items-center justify-center gap-2.5 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              isRandom
                ? "border-purple-500 bg-purple-500/10 text-purple-300 shadow-lg shadow-purple-500/10"
                : "border-dashed border-gray-600 bg-transparent text-gray-400 hover:border-purple-500/60 hover:text-purple-400 hover:bg-purple-500/5"
            }`}
          >
            {isRandom ? (
              <span>랜덤 선택됨 — 면접 시작 시 공개 <span className="text-purple-400/60 text-xs"></span></span>
            ) : (
              <span>랜덤으로 선택하기</span>
            )}
          </button>
        </div>

        {/* 면접 유형 선택 */}
        <div className="space-y-3 text-left">
          <p className="text-sm font-medium text-black/80 text-gray300">면접 유형 선택</p>
          <div className="grid grid-cols-3 gap-3">
            {INTERVIEW_TYPES.map((type) => {
              const isSelected = selectedInterviewType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedInterviewType(type.id)}
                  disabled={isLoading}
                  className={`flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border-2 transition-all duration-200 disabled:cursor-not-allowed ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                      : "border-black/10 hover:border-black-700 hover:border-black/20 hover:bg-black400 bg-transparent"
                  }`}
                >
                  <span className={`text-sm font-semibold ${isSelected ? "text-blue-300" : "text-gray-500"}`}>
                    {type.label}
                  </span>
                  <span className={`text-xs text-center leading-tight ${isSelected ? "text-blue-400/80" : "text-gray-500"}`}>
                    {type.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 직무 선택 */}
        <div className="space-y-3 text-left">
          <p className="text-sm font-medium text-gray-500">
            직무 선택 <span className="text-gray-600 text-xs">(선택)</span>
          </p>
          <JobSelector
            value={selectedJobRole}
            onChange={setSelectedJobRole}
            disabled={isLoading}
          />
        </div>

        {/* 질문 키워드 선택 */}
        <div className="space-y-3 text-left">
          <p className="text-sm font-medium text-gray-500">
            질문 키워드 <span className="text-gray-600 text-xs">(선택, 복수 선택 가능)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {FOCUS_KEYWORDS.map((kw) => (
              <button
                key={kw}
                onClick={() =>
                  setSelectedKeywords((prev) =>
                    prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
                  )
                }
                disabled={isLoading}
                className={`py-1.5 px-3 rounded-full border text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed ${
                  selectedKeywords.includes(kw)
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* 질문 갯수 선택 */}
        <div className="space-y-3 text-left">
          <p className="text-sm font-medium text-gray-500">질문 갯수</p>
          <div className="grid grid-cols-4 gap-2">
            {QUESTION_COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => setQuestionCount(n)}
                disabled={isLoading}
                className={`py-2.5 rounded-lg border text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
                  questionCount === n
                    ? "border-blue-500 bg-blue-500/10 text-blue-300 shadow-lg shadow-blue-500/20"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {n}개
              </button>
            ))}
          </div>
        </div>

        {/* PT면접: 발표 내용 입력 / 그외: 이력서 업로드 */}
        {isPt ? (
          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-300">
                발표 주제 및 내용 <span className="text-red-400">*</span>
              </p>
              <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                {(["file", "type", "random"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setPtMode(mode); setPtContent(""); setPtFileName(""); }}
                    disabled={isLoading}
                    className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                      ptMode === mode
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {mode === "file" ? "파일 업로드" : mode === "type" ? "직접 입력" : "랜덤 생성"}
                  </button>
                ))}
              </div>
            </div>

            {ptMode === "type" && (
              <textarea
                value={ptContent}
                onChange={(e) => setPtContent(e.target.value)}
                disabled={isLoading}
                rows={5}
                placeholder={"발표 주제, 개요, 핵심 내용을 입력하세요.\n예) 주제: 마이크로서비스 전환 전략\n내용: 모놀리식 → MSA 전환 시 고려사항..."}
                className="w-full p-4 rounded-xl bg-gray-900 border-2 border-gray-700 focus:border-blue-500 focus:outline-none text-white placeholder-gray-500 text-sm resize-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            )}

            {ptMode === "file" && (
              <div
                onClick={() => !isLoading && ptFileRef.current?.click()}
                onDrop={async (e) => {
                  e.preventDefault();
                  if (isLoading) return;
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  setPtFileName(file.name);
                  setPtContent(await file.text());
                }}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-gray-900/50 rounded-xl p-8 text-center transition-all duration-300 ${
                  isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
              >
                <input
                  ref={ptFileRef}
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPtFileName(file.name);
                    setPtContent(await file.text());
                  }}
                  disabled={isLoading}
                />
                <div className="flex flex-col items-center gap-2">
                  <UploadIcon className="w-8 h-8 text-gray-500" />
                  {ptFileName ? (
                    <p className="text-purple-400 font-semibold">{ptFileName}</p>
                  ) : (
                    <p className="text-gray-300 text-sm">발표 자료 파일을 드래그하거나 클릭하세요</p>
                  )}
                </div>
              </div>
            )}

            {ptMode === "random" && (
              <div className="space-y-3">
                {ptContent ? (
                  <div className="p-4 rounded-xl bg-gray-900 border-2 border-purple-700 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {ptContent}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-900 border-2 border-dashed border-gray-700 text-sm text-gray-500 text-center">
                    아래 버튼을 눌러 랜덤 주제를 생성하세요
                  </div>
                )}
                <button
                  onClick={() => {
                    const topic = PT_RANDOM_TOPICS[Math.floor(Math.random() * PT_RANDOM_TOPICS.length)];
                    setPtContent(topic);
                  }}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-purple-700 text-purple-300 text-sm hover:bg-purple-900/20 transition-colors disabled:opacity-50"
                >
                  {ptContent ? "다른 주제 생성" : "랜덤 주제 생성"}
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500">입력한 내용을 바탕으로 심층 면접 질문이 생성됩니다.</p>
          </div>
        ) : (
          <div
            onClick={() => !isLoading && fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`relative group border-2 border-dashed border-gray-700 hover:border-blue-500 hover:bg-gray-900/50 rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 ${
              isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={handleFile}
              disabled={isLoading}
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <UploadIcon className="w-10 h-10 text-gray-500 group-hover:text-blue-400 transition-colors" />
              {fileName ? (
                <div>
                  <p className="text-blue-400 font-semibold">{fileName}</p>
                  <p className="text-xs text-gray-500 mt-1">파일을 다시 선택하려면 클릭하세요.</p>
                </div>
              ) : (
                <p className="text-gray-300 font-medium">이력서 파일을 여기에 드래그하거나 클릭하세요</p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm animate-pulse">{error}</p>}

        <button
          onClick={handleStart}
          disabled={isLoading || !hasSelection}
          className="w-full h-12 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-70 disabled:cursor-not-allowed font-semibold transition-all duration-300 text-base shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>질문 생성 중...</span>
            </>
          ) : !selectedInterviewerId ? (
            "면접관을 선택해 주세요"
          ) : !selectedInterviewType ? (
            "면접 유형을 선택해 주세요"
          ) : isPtContentMissing ? (
            "발표 내용을 입력해 주세요"
          ) : isRandom ? (
            "랜덤 면접 시작하기"
          ) : (
            "면접 시작하기"
          )}
        </button>

        <p className="text-center text-xs text-gray-600">
          {isPt
            ? "발표 내용을 바탕으로 맞춤형 PT 면접이 진행됩니다."
            : "이력서 없이도 기본 질문으로 면접을 시작할 수 있습니다."}
        </p>
      </div>
    </main>
  );
}

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}
