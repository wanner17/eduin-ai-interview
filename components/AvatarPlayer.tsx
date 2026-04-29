"use client";

import { useRef, useState } from "react";

interface Props {
  videoUrl: string | null;
  presenterImageUrl: string;
  isLoading: boolean;
  isError: boolean;
  onEnded: () => void;
}

export default function AvatarPlayer({
  videoUrl,
  presenterImageUrl,
  isLoading,
  isError,
  onEnded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsClick, setNeedsClick] = useState(false);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden">
      {presenterImageUrl && (
        <img
          src={presenterImageUrl}
          alt="면접관"
          className="w-full h-full object-cover"
        />
      )}

      {!presenterImageUrl && !videoUrl && (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-6xl">🧑‍💼</span>
        </div>
      )}

      {videoUrl && !isLoading && (
        <video
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          playsInline
          onCanPlay={() => videoRef.current?.play().catch(() => setNeedsClick(true))}
          onEnded={onEnded}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {needsClick && (
        <button
          onClick={() => {
            videoRef.current?.play();
            setNeedsClick(false);
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/40"
        >
          <span className="text-white text-lg font-semibold bg-blue-600 px-6 py-3 rounded-xl">
            ▶ 재생
          </span>
        </button>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <Spinner />
          <p className="mt-3 text-sm text-gray-300">면접관 준비 중...</p>
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
