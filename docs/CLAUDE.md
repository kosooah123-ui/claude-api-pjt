# CLAUDE.md

## Project Overview

**claude-api-pjt**는 냉장고 사진을 업로드하면 AI가 식재료를 인식하고, 인식된 재료로 레시피를 추천해주는 웹 애플리케이션입니다. 하드웨어/센서 연동이나 별도 DB 서버는 없으며, 순수 Node.js 웹 서버 + 로컬 JSON 파일 저장소로 구성된 작은 규모의 프로토타입입니다.

전체 요구사항은 3단계로 나뉘어 있으며 상세 내용은 각 PRD 문서를 참고하세요.

1. [PRD_01](PRD_01.md) — 냉장고 사진 인식 (이미지 → 식재료 목록)
2. [PRD_02](PRD_02.md) — 레시피 생성 (식재료 → 레시피)
3. [PRD_03](PRD_03.md) — 사용자 프로필 및 레시피 저장

## Tech Stack

- **Backend**: Node.js / Express (ESM, `"type": "module"`)
- **AI Model**: OpenRouter API, `nvidia/nemotron-nano-12b-v2-vl:free` (이미지 인식과 레시피 생성 모두 동일 모델 사용)
- **Storage**: JSON 파일 기반 (`data/db.json`) — 별도 DB 서버 없음, `.gitignore`로 제외됨
- **Frontend**: 순수 HTML/CSS/JS (`public/`), 별도 빌드 과정 없음
- **Auth**: 자체 구현 (scrypt 비밀번호 해시 + 메모리 세션 토큰), 서드파티 인증 서비스 없음

## Common Commands

이 프로젝트는 `npm install`, `npm start`, `npm run dev` **세 가지만** 정의되어 있습니다. test/lint/build/migrate/seed 스크립트는 존재하지 않습니다.

```bash
npm install    # 의존성 설치
npm start      # node server.js 실행
npm run dev    # node --watch server.js (파일 변경 시 자동 재시작)
```

## Project Structure

```
server.js                      # Express 앱 진입점, 모든 라우트 정의
src/services/openrouter.js     # OpenRouter API 호출 (이미지 인식 / 레시피 생성)
src/services/auth.js           # 비밀번호 해시, 세션 토큰 발급/검증
src/services/db.js             # data/db.json 읽기/쓰기 헬퍼
src/utils/parseModelJson.js    # 모델 응답에서 JSON 추출 (다중 JSON 조각 대응)
src/utils/sanitizeText.js      # 레시피 텍스트에서 비정상 문자 제거
public/index.html, app.js, style.css  # 프론트엔드 (정적 파일)
data/db.json                   # users/recipes 저장 (gitignore 처리됨)
docs/PRD_01.md ~ PRD_03.md      # 단계별 요구사항 문서
```

## API Endpoints

| Method | Path | 설명 | 인증 필요 |
|---|---|---|---|
| POST | `/api/fridge/recognize` | 이미지 → 식재료 목록 인식 | 아니오 |
| POST | `/api/recipe/generate` | 식재료 목록 → 레시피 생성 | 아니오 |
| POST | `/api/auth/signup` | 회원가입 | 아니오 |
| POST | `/api/auth/login` | 로그인, 세션 토큰 발급 | 아니오 |
| GET | `/api/profile` | 프로필 조회 | 예 |
| PATCH | `/api/profile/preferences` | 알레르기/난이도 선호도 갱신 | 예 |
| POST | `/api/recipes` | 레시피 저장 | 예 |
| GET | `/api/recipes` | 저장된 레시피 목록 조회 | 예 |
| DELETE | `/api/recipes/:id` | 레시피 삭제 | 예 |

인증이 필요한 엔드포인트는 `Authorization: Bearer <token>` 헤더를 사용합니다.

## Environment Setup

1. `.env` 파일 생성 (`.env.example` 참고):
   ```bash
   cp .env.example .env
   ```
2. OpenRouter API 키 설정:
   ```
   OPENROUTER_API_KEY=your_key_here
   ```
3. 설치 및 실행:
   ```bash
   npm install
   npm start
   ```
4. 브라우저에서 `http://localhost:3000` 접속

**중요**: `.env`와 `data/`는 `.gitignore`에 포함되어 있으며 절대 커밋하지 않습니다.

## Known Limitations

- **AI 모델 품질**: `nemotron-nano-12b-v2-vl:free`는 무료 소형 모델이라 이미지 인식/레시피 생성 결과에 환각(존재하지 않는 재료명, 부자연스럽거나 언어가 섞인 문장)이 종종 섞입니다. `sanitizeText.js`로 일부 걸러내지만 완전히 제거되지는 않습니다. 사용자가 인식 결과를 직접 수정할 수 있는 UI를 제공합니다.
- **세션**: 로그인 토큰은 서버 메모리에만 저장되어 서버 재시작 시 모든 세션이 초기화됩니다.
- **저장소**: `data/db.json` 파일 기반이라 동시 다중 사용자/쓰기 경합에는 적합하지 않습니다. 실서비스 전환 시 실제 DB로 교체가 필요합니다.
- **정적 파일 경로**: `express.static`은 `__dirname` 기반 절대경로를 사용하므로 실행 위치(cwd)와 무관하게 동작합니다 (Vercel 등 서버리스 배포 호환).

## Development Notes

- API 응답은 항상 `{ status: "ok" | "error", ... }` 형태를 따릅니다.
- 모델 호출은 `src/services/openrouter.js`의 `callOpenRouter()`가 담당하며, 502/504 등 일시적 오류에 대해 최대 2회 자동 재시도합니다.
- 모델이 JSON을 여러 조각(`[{...}] [{...}]`)으로 나눠 응답하는 경우가 있어 `parseModelJson.js`가 이를 병합해 파싱합니다.
- API 키나 비밀번호를 로그에 출력하지 않도록 주의하세요.

Openrouter API를 이용해서 실제 AI 모델이 이미지를 인식하고 
레시피를 생성하게 해줘. 
매번 실행할때마다 API가 정확하게 작동하는지, 
AI 모델이 문제없이 실행되는지 파악하고 
문제가 있다면 어떤 문제가 있는지 보고해.
