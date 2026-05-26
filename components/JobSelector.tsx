"use client";

import { useState, useEffect, useRef } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface JobResult {
  name: string;  // 세분류 (AI에 전달)
  major: string; // 대분류
  mid: string;   // 중분류
  minor: string; // 소분류
}

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function JobSelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query) { setResults([]); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_PATH}/api/job-categories/?query=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error();
        setResults(await res.json() as JobResult[]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const handleSelect = (item: JobResult) => {
    onChange(item.name);
    closeModal();
  };

  const closeModal = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <>
      <div className="flex gap-2 items-stretch">
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={`flex-1 px-4 py-2.5 rounded-lg bg-gray-900 border-2 border-gray-700 text-sm transition-colors ${
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-gray-500"
          } ${value ? "text-white" : "text-gray-500"}`}
        >
          {value || "지원 직무를 선택해 주세요"}
        </div>
        <button
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          className="px-4 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-sm text-gray-100 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          찾아보기
        </button>
        {value && !disabled && (
          <button
            onClick={() => onChange(null)}
            className="px-3 py-2.5 rounded-lg bg-gray-800 text-gray-400 hover:text-gray-200 text-xs transition-colors"
            aria-label="선택 초기화"
          >
            ✕
          </button>
        )}
      </div>
      {!value && (
        <p className="text-xs text-blue-400/70 mt-1.5">
          원하는 직무가 없을 경우 가장 비슷한 직무를 선택해 주세요.
        </p>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden"
            style={{ maxHeight: "78vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800">직무 검색</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-light"
              >
                ×
              </button>
            </div>

            {/* Search input */}
            <div className="px-4 py-3 border-b flex-shrink-0">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base select-none">
                  🔍
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="직무 키워드 입력 (예: 개발자, 마케팅, 회계)"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-blue-500 focus:outline-none text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Results */}
            <div className="overflow-y-auto flex-1">
              {loading && (
                <div className="p-6 text-center text-sm text-gray-400">검색 중...</div>
              )}

              {!loading && !query && (
                <div className="p-6 text-center text-sm text-gray-400">
                  키워드를 입력하면 관련 직무 목록이 표시됩니다.
                </div>
              )}

              {!loading && query && results.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">
                  <p className="font-medium">검색 결과가 없습니다.</p>
                  <p className="text-xs mt-1 text-gray-300">다른 키워드로 검색해 보세요.</p>
                </div>
              )}

              {results.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-5 py-3.5 border-b last:border-b-0 transition-colors hover:bg-blue-50 ${
                    value === item.name ? "bg-blue-50" : ""
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    {value === item.name && (
                      <span className="text-blue-500 text-xs">✓</span>
                    )}
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.major} &gt; {item.mid} &gt; {item.minor}
                  </p>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t bg-gray-50 flex-shrink-0">
              <p className="text-xs text-gray-400">
                원하는 직무가 없으면 가장 유사한 직무를 선택하세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
