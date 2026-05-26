import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.WORK24_API_KEY ?? "";

interface RawJobResult {
  centerLabel: string;
  job_lcfn: string; // 대분류
  job_mcn: string;  // 중분류
  job_scfn: string; // 소분류
  job_sdvn: string; // 세분류
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";

  if (!query) return NextResponse.json([]);
  if (!API_KEY) return NextResponse.json([]);

  const params = new URLSearchParams({
    authKey: API_KEY,
    word: query,
    limit: "30",
    returnType: "JSON",
  });

  try {
    const res = await fetch(
      `https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo215L11.do?${params.toString()}`
    );

    const data = await res.json() as {
      result?: Record<string, RawJobResult>;
      message_cd?: string;
      message?: string;
    };

    if (!data.result) return NextResponse.json([]);

    // 세분류(job_sdvn) 기준으로 중복 제거
    const seen = new Set<string>();
    const results = Object.values(data.result)
      .filter((item) => {
        if (seen.has(item.job_sdvn)) return false;
        seen.add(item.job_sdvn);
        return true;
      })
      .map((item) => ({
        name: item.job_sdvn,
        major: item.job_lcfn,
        mid: item.job_mcn,
        minor: item.job_scfn,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
