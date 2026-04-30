"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { SessionData, SessionQA } from "@/types/interview";
import AvatarPlayer from "@/components/AvatarPlayer";
import { getInterviewer, type Interviewer } from "@/lib/interviewers";

type AvatarState = "generating" | "playing" | "ready" | "fallback";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const router = useRouter();

  const webcamRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const preparedAudio = useRef<Map<number, ArrayBuffer | null>>(new Map());
  const currentIndexRef = useRef(0);

  const [session, setSession] = useState<SessionData | null>(null);
  const [interviewer, setInterviewer] = useState<Interviewer>(getInterviewer("kim"));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sttSupported, setSttSupported] = useState(true);

  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState(0);

  const [avatarState, setAvatarState] = useState<AvatarState>("generating");
  const [currentAudioBuffer, setCurrentAudioBuffer] = useState<ArrayBuffer | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    fetch(`${BASE_PATH}/api/session/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SessionData | null) => {
        setSession(data);
        if (data) setInterviewer(getInterviewer(data.interviewerId));
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [sessionId]);

  const setWebcamRef = useCallback((el: HTMLVideoElement | null) => {
    (webcamRef as { current: HTMLVideoElement | null }).current = el;
    if (el && streamRef.current) el.srcObject = streamRef.current;
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (webcamRef.current) webcamRef.current.srcObject = stream;
      })
      .catch(console.error);

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    setIsPreparing(true);
    setPrepareProgress(0);
    const voice = getInterviewer(session.interviewerId).voice;

    (async () => {
      for (let i = 0; i < session.qas.length; i++) {
        const buf = await fetchAudioForIndex(session.qas[i].question, voice);
        preparedAudio.current.set(i, buf);
        setPrepareProgress(i + 1);
      }
      setIsPreparing(false);
      loadAudioFromCache(0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    if (isPreparing || !session) return;
    loadAudioFromCache(currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  function loadAudioFromCache(idx: number) {
    const buf = preparedAudio.current.get(idx) ?? null;
    setCurrentAudioBuffer(null);
    setAvatarError(false);
    if (buf) {
      setCurrentAudioBuffer(buf);
      setAvatarState("generating");
    } else {
      setAvatarError(true);
      setAvatarState("fallback");
    }
  }

  async function fetchAudioForIndex(questionText: string, voice?: string): Promise<ArrayBuffer | null> {
    try {
      const speakRes = await fetch(`${BASE_PATH}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: questionText, voice }),
      });
      const { audioId } = (await speakRes.json()) as { audioId: string | null };
      if (!audioId) return null;

      const audioRes = await fetch(`${BASE_PATH}/api/audio/${audioId}`);
      if (!audioRes.ok) return null;
      return await audioRes.arrayBuffer();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      setSttSupported(false);
      setIsRecording(true);
      setElapsed(0);
      return;
    }

    const recognition = new SR();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setElapsed(0);
    setTranscript("");
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  const submitAnswer = useCallback(async () => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    stopRecording();

    const qa: SessionQA = session.qas[currentIndex];
    const isLast = currentIndex === session.qas.length - 1;

    await fetch(`${BASE_PATH}/api/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qaId: qa.id, answer: transcript, isLast }),
    });

    if (!isLast) {
      setCurrentIndex((i) => i + 1);
      setTranscript("");
      setIsSubmitting(false);
    } else {
      window.parent.postMessage(
        { type: "INTERVIEW_COMPLETE", sessionId },
        "*"
      );
      router.push(`/result/${sessionId}`);
    }
  }, [
    session,
    currentIndex,
    transcript,
    isSubmitting,
    sessionId,
    router,
    stopRecording,
  ]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const canStartRecording =
    avatarState === "ready" || avatarState === "fallback";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-4">
        <Spinner />
        <p className="text-gray-400">면접 세션을 불러오는 중...</p>
      </div>
    );
  }

  if (isPreparing && session) {
    const total = session.qas.length;
    const pct = Math.round((prepareProgress / total) * 100);
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-8 px-6">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-xl font-semibold">면접 준비 중입니다</p>
          <p className="text-gray-400 text-sm">잠시만 기다려 주세요...</p>
        </div>
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>질문 생성 중</span>
            <span>{prepareProgress} / {total}</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-lg text-red-400">면접 세션을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const currentQA = session.qas[currentIndex];
  const progress = ((currentIndex + 1) / session.qas.length) * 100;
  const isLast = currentIndex === session.qas.length - 1;

  return (
    <main className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">AI 면접</span>
          <div className="h-4 w-px bg-gray-700" />
          <span className="text-sm text-gray-400">
            질문 {currentIndex + 1} / {session.qas.length}
          </span>
          <div className="h-4 w-px bg-gray-700" />
          <span className="text-sm text-blue-400">
            {interviewer.name} <span className="text-gray-500">· {interviewer.role}</span>
          </span>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-400 font-mono tabular-nums">
              {formatTime(elapsed)}
            </span>
          </div>
        )}
      </header>

      <div className="h-1 bg-gray-800 shrink-0">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 아바타 + 웹캠 */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-4 overflow-hidden min-h-0">
        {/* 아바타 패널 */}
        <motion.div
          className="relative min-h-0"
          animate={{
            flex: avatarState === "playing" ? 1.8 : isRecording ? 0.5 : 1,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <AvatarPlayer
            audioBuffer={currentAudioBuffer}
            presenterImageUrl={interviewer.imageUrl}
            faceId={interviewer.faceId}
            isError={avatarError}
            onStarted={() => setAvatarState("playing")}
            onEnded={() => setAvatarState("ready")}
            onError={() => { setAvatarError(true); setAvatarState("fallback"); }}
          />
          {/* 질문 자막 */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pt-8 pb-4 rounded-b-xl pointer-events-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: avatarState === "generating" ? 0 : 1,
                  y: avatarState === "generating" ? 10 : 0,
                }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest block mb-1.5">
                  질문 {currentIndex + 1}
                </span>
                <p className="text-base font-semibold leading-relaxed text-white drop-shadow">
                  {currentQA.question}
                </p>
                {currentQA.intent && (
                  <p className="mt-1 text-xs text-gray-400">
                    <span className="text-gray-500">평가 의도 </span>
                    {currentQA.intent}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* 내 웹캠 */}
        <motion.div
          className="relative rounded-xl overflow-hidden bg-gray-900 min-h-0"
          animate={{
            flex: isRecording ? 1.8 : avatarState === "playing" ? 0.5 : 1,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <video
            ref={setWebcamRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              REC
            </div>
          )}
          <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
            <span className="text-xs text-gray-500 bg-black/50 px-2 py-1 rounded-full">
              나
            </span>
          </div>
        </motion.div>
      </div>

      {/* STT 자막 */}
      <div className="shrink-0 min-h-[60px] px-6 py-3 bg-gray-900 border-t border-gray-800 flex items-center gap-3">
        <div className="text-xs text-gray-500 shrink-0">실시간 자막</div>
        <p className="text-sm text-gray-300 leading-relaxed flex-1">
          {transcript ||
            (isRecording
              ? "음성을 인식하고 있습니다..."
              : avatarState === "generating"
                ? "면접관이 질문을 준비하고 있습니다..."
                : avatarState === "playing"
                  ? "면접관이 질문 중입니다..."
                  : "답변 시작 버튼을 눌러주세요.")}
        </p>
      </div>

      {/* 컨트롤 */}
      <div className="shrink-0 px-6 py-4 bg-gray-950 border-t border-gray-800">
        {!sttSupported && (
          <>
            <div className="mb-3 p-3 rounded-lg bg-yellow-900/40 border border-yellow-800 text-yellow-300 text-xs">
              이 브라우저는 음성 인식을 지원하지 않습니다. 직접 입력해 주세요.
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={3}
              placeholder="답변을 직접 입력하세요..."
              className="w-full mb-3 p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-500 text-sm resize-none transition-colors"
            />
          </>
        )}
        <div className="flex gap-3">
          {sttSupported &&
            (!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isSubmitting || !canStartRecording}
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors text-base"
              >
                {avatarState === "generating"
                  ? "면접관 준비 중..."
                  : avatarState === "playing"
                    ? "질문 듣는 중..."
                    : "답변 시작"}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-500 font-semibold transition-colors text-base"
              >
                답변 중지
              </button>
            ))}
          <button
            onClick={submitAnswer}
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 font-semibold transition-colors text-base"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <Spinner className="h-5 w-5 mr-2" />
                처리 중...
              </div>
            ) : isLast ? (
              "면접 완료"
            ) : (
              "다음 질문 →"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

function Spinner(props: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-8 w-8 text-blue-400 ${props.className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
