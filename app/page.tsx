"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeContent: resumeText || null,
          callbackUrl: null,
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

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-gray-950 to-black flex items-center justify-center text-white p-4 sm:p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-300 to-blue-500 bg-clip-text text-transparent">
            이력서를 업로드하고,<br/>맞춤형 면접을 경험해보세요.
          </h1>
          {/* <p className="text-gray-400">
            
          </p> */}
        </div>

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
                <p className="text-xs text-gray-500 mt-1">
                  파일을 다시 선택하려면 클릭하세요.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-300 font-medium">
                  이력서 파일을 여기에 드래그하거나 클릭하세요
                </p>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm animate-pulse">{error}</p>}

        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full h-12 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-70 disabled:cursor-not-allowed font-semibold transition-all duration-300 text-base shadow-lg shadow-blue-600/20 hover:shadow-blue-500/40"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>질문 생성 중...</span>
            </>
          ) : (
            "면접 시작하기"
          )}
        </button>

        <p className="text-center text-xs text-gray-600">
          이력서 없이도 기본 질문으로 면접을 시작할 수 있습니다.
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
