# AI 취업 면접 시스템 — 구현 플랜

## 현재 상태 분석

| 항목 | 상태 | 비고 |
|------|------|------|
| schema.prisma | 존재 (부분) | QA에 intent/keywords 필드 없음 |
| generator.ts | 루트에 방치 | Gemini 기반, app/ 구조 밖 |
| route.ts | 루트에 방치 | Next.js App Router 구조 아님 |
| 프론트엔드 | 보일러플레이트만 | 면접 UI 없음 |
| .env | 없음 | 생성 필요 |
| 패키지 | prisma/openai/gcl-stt 없음 | 설치 필요 |

## 요구사항 요약

- 기존 TiDB(MySQL) 데이터 **보존** 하면서 면접 시스템 테이블 추가
- 독립 서버로 운영, 다른 프로젝트에 **iframe 임베드**
- AI: OpenAI GPT-4o (질문 생성) + Google Cloud STT (실시간 자막)
- TypeScript 전체

---

## 0단계: 데이터 유실 방지 주의사항

> **WARNING: 아래 명령 실행 전 반드시 DB 백업**

```bash
# 백업 먼저
mysqldump -u root -p interview_db > backup_$(date +%Y%m%d).sql

# db pull: 기존 테이블 → schema.prisma 동기화 (READ ONLY, 안전)
npx prisma db pull

# migrate dev: 새 마이그레이션 파일 생성 + 적용
# → 기존 테이블 건드리지 않고 신규 테이블만 추가
npx prisma migrate dev --name add_interview_models

# db push: 마이그레이션 파일 없이 직접 적용 (개발용)
# → 프로덕션에서 절대 사용 금지
# → shadow DB 필요 (TiDB는 shadow DB 미지원 → db push 권장)
npx prisma db push
```

**TiDB 특이사항:** TiDB는 `prisma migrate dev`의 shadow database를 지원하지 않음.
→ 개발환경은 `db push`, 프로덕션은 수동 SQL 마이그레이션 사용 권장.

---

## 1단계: 패키지 설치 및 환경 설정

### 설치 패키지
```bash
npm install @prisma/client openai @google-cloud/speech
npm install -D prisma
```

### .env.local
```env
DATABASE_URL="mysql://root:@localhost:4000/interview_db"
OPENAI_API_KEY="sk-..."
GOOGLE_APPLICATION_CREDENTIALS="./gcp-credentials.json"

# iframe 허용 origin (CORS)
ALLOWED_ORIGINS="http://localhost:3001,https://your-main-app.com"
```

### next.config.ts — iframe 허용 헤더 추가
```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" }, // 또는 ALLOW-FROM
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};
```

---

## 2단계: Prisma 초기설정 + 기존 DB 연동

### 워크플로우
```
1. .env에 DATABASE_URL 설정
2. npx prisma db pull          → 기존 테이블 → schema.prisma 자동 생성
3. schema.prisma에 신규 모델 추가 (아래 참조)
4. npx prisma db push          → 신규 테이블만 추가 (기존 데이터 보존)
5. npx prisma generate         → PrismaClient 타입 생성
```

### schema.prisma 수정사항

현재 QA 모델에 **추가 필요한 필드:**
```prisma
model QA {
  // 기존 필드 유지 ...
  intent    String?  @db.Text    // 질문 의도 (새로 추가)
  keywords  String?  @db.Text    // JSON 배열 문자열 (새로 추가)
}
```

**User 테이블이 이미 있는 경우 확장 방법:**
```prisma
// 기존 User 모델에 relation만 추가 (테이블 구조 변경 없음)
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String?
  createdAt DateTime  @default(now())
  
  // 신규 relation 추가
  resumes   Resume[]
  sessions  InterviewSession[]
}
```

---

## 3단계: 파일 구조 재편

```
src/
├── app/
│   ├── api/
│   │   └── interview/
│   │       ├── init/route.ts          # POST: 세션 생성 + 질문 생성
│   │       ├── answer/route.ts        # POST: 답변 저장 + 피드백
│   │       └── session/[id]/route.ts  # GET: 세션 조회
│   ├── interview/
│   │   ├── [id]/
│   │   │   └── page.tsx              # 면접 진행 UI
│   │   └── complete/page.tsx         # 면접 완료 + 결과
│   └── page.tsx                      # 이력서 입력 (진입점)
├── lib/
│   ├── ai/
│   │   ├── openai.ts                 # 질문 생성 (GPT-4o)
│   │   └── stt.ts                    # Google Cloud STT
│   ├── prisma.ts                     # PrismaClient 싱글톤
│   └── interview.ts                  # 비즈니스 로직
└── types/
    └── interview.ts                  # 공유 타입 정의
```

---

## 4단계: 핵심 구현 코드

### 4-1. src/lib/prisma.ts
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 4-2. src/types/interview.ts
```typescript
export interface GeneratedQuestion {
  question: string;
  intent: string;       // 질문 의도
  keywords: string[];   // 평가 키워드
  type: "technical" | "experience" | "personality";
}

export interface QuestionGenerationResult {
  questions: GeneratedQuestion[];
}
```

### 4-3. src/lib/ai/openai.ts (GPT-4o, JSON mode)
```typescript
import OpenAI from "openai";
import type { GeneratedQuestion, QuestionGenerationResult } from "@/types/interview";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `당신은 10년 경력의 기술 면접관입니다.
이력서를 분석하여 다음 규칙으로 질문 5개를 생성하세요:
- 기술 질문 2개 (technical)
- 경험 질문 2개 (experience)  
- 인성 질문 1개 (personality)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "questions": [
    {
      "question": "질문 내용",
      "intent": "이 질문을 하는 이유와 평가 목적",
      "keywords": ["핵심 키워드1", "핵심 키워드2"],
      "type": "technical|experience|personality"
    }
  ]
}`;

export async function generateInterviewQuestions(
  resumeContent: string
): Promise<GeneratedQuestion[]> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `다음 이력서를 분석하여 면접 질문을 생성하세요:\n\n${resumeContent}` },
    ],
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("OpenAI 응답 없음");

  const result: QuestionGenerationResult = JSON.parse(content);
  return result.questions;
}
```

### 4-4. src/app/api/interview/init/route.ts
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInterviewQuestions } from "@/lib/ai/openai";

export async function POST(req: NextRequest) {
  const { userId, resumeContent } = await req.json();

  if (!userId || !resumeContent) {
    return NextResponse.json({ error: "userId, resumeContent 필수" }, { status: 400 });
  }

  const questions = await generateInterviewQuestions(resumeContent);

  const session = await prisma.$transaction(async (tx) => {
    const resume = await tx.resume.create({
      data: { userId, content: resumeContent },
    });

    const session = await tx.interviewSession.create({
      data: {
        userId,
        resumeId: resume.id,
        status: "CREATED",
        qas: {
          create: questions.map((q) => ({
            question: q.question,
            intent: q.intent,
            keywords: JSON.stringify(q.keywords),
          })),
        },
      },
      include: { qas: true },
    });

    return session;
  });

  return NextResponse.json({ sessionId: session.id });
}
```

### 4-5. src/lib/ai/stt.ts (Google Cloud STT)
```typescript
import speech from "@google-cloud/speech";

const client = new speech.SpeechClient();

export async function transcribeAudio(audioBase64: string): Promise<string> {
  const [response] = await client.recognize({
    audio: { content: audioBase64 },
    config: {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode: "ko-KR",
      enableAutomaticPunctuation: true,
    },
  });

  return response.results
    ?.map((r) => r.alternatives?.[0]?.transcript ?? "")
    .join(" ") ?? "";
}
```

---

## 5단계: 면접 진행 UI

### src/app/interview/[id]/page.tsx 레이아웃
```
┌─────────────────────────────────────────────────────┐
│  [로고/타이머]                    [질문 N/5]         │
├──────────────────────┬──────────────────────────────┤
│                      │  현재 질문                    │
│   웹캠 화면          │  ──────────────────────────  │
│   (MediaRecorder)    │  "React에서 상태 관리를..."   │
│                      │                              │
│                      │  [다음 질문] [답변 완료]      │
├──────────────────────┴──────────────────────────────┤
│  STT 자막: "저는 Redux를 주로 사용했으며..."          │
└─────────────────────────────────────────────────────┘
```

**핵심 컴포넌트:**
- `WebcamRecorder`: MediaDevices API, MediaRecorder, Canvas 스냅샷
- `QuestionDisplay`: 현재 질문 + 진행도 표시
- `SttSubtitle`: WebSocket 또는 폴링으로 실시간 자막
- `InterviewTimer`: 질문별 타이머 (선택사항)

---

## 6단계: iframe 임베드 설정

### 호출 프로젝트에서 사용법
```html
<iframe
  src="https://interview.your-domain.com/interview/{sessionId}"
  width="1200"
  height="700"
  allow="camera; microphone"
  style="border: none;"
/>
```

**postMessage로 세션 완료 통신:**
```typescript
// interview 앱 (자식)
window.parent.postMessage({ type: "INTERVIEW_COMPLETE", sessionId }, "*");

// 호출 프로젝트 (부모)
window.addEventListener("message", (e) => {
  if (e.data.type === "INTERVIEW_COMPLETE") {
    // 면접 완료 처리
  }
});
```

---

## 구현 순서 (권장)

1. **[즉시]** `npm install`, `.env.local` 생성
2. **[DB]** `npx prisma db pull` → schema에 intent/keywords 추가 → `npx prisma db push`
3. **[백엔드]** `src/lib/prisma.ts` → `src/lib/ai/openai.ts` → `src/app/api/interview/init/route.ts`
4. **[프론트]** 홈(이력서 입력) → 면접 UI 순서로 구현
5. **[STT]** Google Cloud STT 연동 (GCP 자격증명 설정 후)
6. **[배포]** Docker-compose로 로컬 검증 → iframe 테스트

---

## 수락 기준 (Acceptance Criteria)

- [ ] `POST /api/interview/init` → 200, sessionId 반환
- [ ] OpenAI GPT-4o가 질문 5개 (기술2/경험2/인성1) JSON 반환
- [ ] DB: Resume + InterviewSession + QA 3개 테이블 생성, 기존 테이블 영향 없음
- [ ] 면접 페이지: 웹캠 스트림 표시, 질문 순차 출력
- [ ] STT: 마이크 음성 → 한국어 자막 표시
- [ ] iframe 임베드 시 카메라/마이크 권한 작동
- [ ] `postMessage`로 완료 이벤트 부모에 전달

---

## 리스크 & 대응

| 리스크 | 대응 |
|--------|------|
| TiDB shadow DB 미지원 | `db push` 사용, 프로덕션은 수동 SQL |
| 기존 User 테이블 구조 불일치 | `db pull` 후 확인, externalUserId(String) 대안 |
| 웹캠 권한 iframe 차단 | `allow="camera; microphone"` 필수 |
| OpenAI 응답 파싱 실패 | zod 스키마 검증 추가 권장 |
| STT 지연 | 청크 단위 스트리밍 STT 사용 |
