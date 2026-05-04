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
}

export default function AvatarPlayer({
  audioBuffer,
  presenterImageUrl,
  faceId,
  isError,
  onStarted,
  onEnded,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<{ sendAudioData: (d: Uint8Array) => void; close?: () => void } | null>(null);
  const callbacksRef = useRef({ onStarted, onEnded, onError });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onStarted, onEnded, onError };
  });

  useEffect(() => {
    if (!audioBuffer) return;

    let cancelled = false;
    let endedTimer: ReturnType<typeof setTimeout> | null = null;
    setIsConnecting(true);
    setIsConnected(false);

    (async () => {
      try {
        const tokenRes = await fetch(`${BASE_PATH}/api/simli-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ faceId }),
        });
        const { session_token } = (await tokenRes.json()) as { session_token: string };
        if (cancelled) return;

        const pcm = await mp3ToPcm16(audioBuffer);
        if (cancelled) return;
        // PCM16 @ 16kHz mono → duration in ms
        const durationMs = (pcm.length / 2 / 16000) * 1000;

        const { SimliClient, LogLevel } = await import("simli-client");
        if (cancelled) return;

        const client = new SimliClient(
          session_token,
          videoRef.current!,
          audioRef.current!,
          null,
          LogLevel.CRITICAL,
          "livekit"
        );
        clientRef.current = client;

        const c = client as unknown as { on: (e: string, cb: () => void) => void };
        c.on("start", () => {
          if (cancelled) return;
          setIsConnecting(false);
          setIsConnected(true);
          callbacksRef.current.onStarted();
          const chunkSize = 6000;
          for (let i = 0; i < pcm.length; i += chunkSize) {
            client.sendAudioData(pcm.slice(i, i + chunkSize));
          }
          // fire onEnded after audio duration + 500ms buffer
          endedTimer = setTimeout(() => {
            if (!cancelled) callbacksRef.current.onEnded();
          }, durationMs + 500);
        });
        c.on("error", () => {
          if (cancelled) return;
          setIsConnecting(false);
          callbacksRef.current.onError();
        });

        await client.start();
      } catch {
        if (!cancelled) {
          setIsConnecting(false);
          callbacksRef.current.onError();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (endedTimer) clearTimeout(endedTimer);
      setIsConnecting(false);
      setIsConnected(false);
      const c = clientRef.current as { stop?: () => void } | null;
      c?.stop?.();
      clientRef.current = null;
    };
  }, [audioBuffer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden">
      {presenterImageUrl && !isConnected && !isConnecting && (
        <img src={presenterImageUrl} alt="면접관" className="w-full h-full object-contain" />
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <audio ref={audioRef} autoPlay />

      {isConnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <Spinner />
          <p className="mt-3 text-sm text-gray-300">면접관 준비 중...</p>
        </div>
      )}

      {isError && !isConnecting && (
        <div className="absolute bottom-3 left-0 right-0 text-center">
          <span className="text-xs text-gray-500 bg-black/50 px-2 py-1 rounded-full">
            텍스트 모드
          </span>
        </div>
      )}
    </div>
  );
}

async function mp3ToPcm16(mp3Buffer: ArrayBuffer): Promise<Uint8Array> {
  const decodeCtx = new AudioContext();
  const audioBuffer = await decodeCtx.decodeAudioData(mp3Buffer.slice(0));
  await decodeCtx.close();

  const sampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(audioBuffer.duration * sampleRate),
    sampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();

  const rendered = await offlineCtx.startRendering();
  const float32 = rendered.getChannelData(0);
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
  }
  return new Uint8Array(pcm16.buffer);
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-8 w-8 text-blue-400"
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
