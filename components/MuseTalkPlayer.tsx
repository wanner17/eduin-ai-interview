"use client";

import { useEffect, useRef, useState } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface Props {
  audioBuffer: ArrayBuffer | null;
  presenterImageUrl: string;
  faceId?: string;
  isError: boolean;
  onStarted: () => void;
  onEnded: () => void;
  onError: () => void;
  preloadedFrames?: string[] | null;
}

export default function MuseTalkPlayer({
  audioBuffer,
  presenterImageUrl,
  faceId = "1",
  isError,
  onStarted,
  onEnded,
  onError,
  preloadedFrames,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onStarted, onEnded, onError });
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onStarted, onEnded, onError };
  });

  useEffect(() => {
    if (!audioBuffer) return;

    let cancelled = false;
    setIsLoading(true);
    setIsPlaying(false);

    (async () => {
      let audioUrl: string | null = null;
      try {
        let frames: string[];
        const fps = 25;
        if (preloadedFrames && preloadedFrames.length > 0) {
          frames = preloadedFrames;
        } else {
          const res = await fetch(
            `${BASE_PATH}/api/musetalk?interviewer_id=${faceId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
              body: audioBuffer,
            }
          );
          if (!res.ok) throw new Error(`musetalk api ${res.status}`);
          const json = (await res.json()) as { frames: string[]; fps: number };
          frames = json.frames;
        }
        if (cancelled) return;

        // Preload images
        const images = await Promise.all(
          frames.map(
            (b64) =>
              new Promise<HTMLImageElement>((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = `data:image/jpeg;base64,${b64}`;
              })
          )
        );
        if (cancelled) return;

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        if (images[0]) {
          canvas.width = images[0].naturalWidth;
          canvas.height = images[0].naturalHeight;
        }

        // Play audio
        audioUrl = URL.createObjectURL(
          new Blob([audioBuffer], { type: "audio/mpeg" })
        );
        const audio = audioRef.current!;
        audio.src = audioUrl;

        setIsLoading(false);
        setIsPlaying(true);
        callbacksRef.current.onStarted();

        await audio.play();

        // audio.currentTime 기준으로 프레임 결정 → 드리프트 없음
        const animate = () => {
          if (cancelled) return;
          const frameIdx = Math.min(
            Math.floor(audio.currentTime * fps),
            images.length - 1
          );
          if (images[frameIdx]) ctx.drawImage(images[frameIdx], 0, 0);
          animRef.current = requestAnimationFrame(animate);
        };
        animRef.current = requestAnimationFrame(animate);

        audio.onended = () => {
          if (!cancelled) callbacksRef.current.onEnded();
        };
      } catch {
        if (!cancelled) {
          setIsLoading(false);
          callbacksRef.current.onError();
        }
      } finally {
        if (cancelled && audioUrl) URL.revokeObjectURL(audioUrl);
      }
    })();

    return () => {
      cancelled = true;
      setIsLoading(false);
      setIsPlaying(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [audioBuffer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden">
      {presenterImageUrl && !isPlaying && !isLoading && (
        <img
          src={presenterImageUrl}
          alt="면접관"
          className="w-full h-full object-contain"
        />
      )}

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ display: isPlaying ? "block" : "none" }}
      />
      <audio ref={audioRef} />

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <Spinner />
          <p className="mt-3 text-sm text-gray-300">질문 준비 중...</p>
        </div>
      )}

      {isError && !isLoading && (
        <div className="absolute bottom-3 left-0 right-0 text-center">
          <span className="text-xs text-gray-500 bg-black/50 px-2 py-1 rounded-full">
            텍스트 모드
          </span>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-8 w-8 text-blue-400"
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
