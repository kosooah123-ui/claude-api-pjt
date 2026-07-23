# PRD_03: 사용자 프로필 및 레시피 저장

## 1. 개요
사용자가 계정을 만들고, [[PRD_02]]에서 생성된 레시피를 자신의 프로필에 저장/조회/삭제할 수 있는 기능. 전체 파이프라인의 마지막 단계로, 별도의 AI 모델 호출은 없고 인증 및 데이터 저장에 집중한다.

## 2. 목표
- 사용자가 간단한 프로필(계정)을 생성하고 로그인할 수 있다.
- 마음에 든 레시피를 프로필에 저장하고, 저장된 레시피 목록을 조회/삭제할 수 있다.
- (선택) 프로필에 알레르기/선호도를 저장해 [[PRD_02]] 요청 시 기본값으로 재사용한다.

## 3. 범위
### In scope
- 사용자 계정 생성/로그인 (이메일 기반 또는 간단한 인증)
- 레시피 저장(`POST`), 목록 조회(`GET`), 삭제(`DELETE`)
- 프로필에 알레르기/선호도 저장 및 [[PRD_02]] 요청 시 자동 반영

### Out of scope
- 이미지 인식 ([[PRD_01]]), 레시피 생성 로직 ([[PRD_02]]) 자체
- 소셜 로그인, 비밀번호 재설정 이메일 발송 등 완전한 인증 시스템 (MVP 이후 과제)
- 레시피 공유/커뮤니티 기능

## 4. 사용자 플로우
1. 사용자가 회원가입/로그인
2. [[PRD_02]]에서 생성된 레시피 카드에서 "저장" 버튼 클릭
3. 백엔드가 해당 레시피를 사용자 프로필에 연결하여 DB에 저장
4. 사용자가 "내 레시피" 페이지에서 저장된 레시피 목록 조회
5. 필요 시 레시피 삭제

## 5. 데이터 모델
```
User {
  id: string (uuid)
  email: string
  password_hash: string
  created_at: datetime
  preferences: {
    allergies: string[]
    difficulty: "easy" | "medium" | "hard" | null
  }
}

SavedRecipe {
  id: string (uuid)
  user_id: string (User.id 참조)
  title: string
  used_ingredients: string[]
  missing_ingredients: string[]
  steps: string[]
  estimated_time_minutes: number
  difficulty: string
  saved_at: datetime
}
```
`SavedRecipe`의 필드는 [[PRD_02]]의 `Recipe` 스키마와 1:1 대응된다.

## 6. API 설계

### `POST /api/auth/signup`
**Request**: `{ "email": "...", "password": "..." }`
**Response**: `{ "status": "ok", "user_id": "..." }`

### `POST /api/auth/login`
**Request**: `{ "email": "...", "password": "..." }`
**Response**: `{ "status": "ok", "token": "..." }`

### `GET /api/profile`
인증 토큰 필요. 사용자 프로필(선호도 포함) 조회.

### `PATCH /api/profile/preferences`
**Request**: `{ "allergies": ["땅콩"], "difficulty": "easy" }`
프로필의 선호도 갱신. 이후 [[PRD_02]]의 `POST /api/recipe/generate` 호출 시 `preferences`의 기본값으로 사용.

### `POST /api/recipes` (저장)
**Request**: [[PRD_02]]의 `Recipe` 객체 그대로 전달
**Response**: `{ "status": "ok", "saved_recipe_id": "..." }`

### `GET /api/recipes` (목록 조회)
**Response**
```json
{
  "status": "ok",
  "recipes": [
    { "id": "...", "title": "계란 우유 스크램블", "saved_at": "2026-07-23T10:00:00Z", "...": "..." }
  ]
}
```

### `DELETE /api/recipes/:id`
**Response**: `{ "status": "ok" }`

## 7. 인증/보안 고려사항
- 비밀번호는 해시(bcrypt 등)로 저장, 평문 저장 금지
- 인증 토큰(JWT 등)으로 `/api/profile`, `/api/recipes` 접근 제어
- 다른 사용자의 `SavedRecipe`에 대한 접근 차단 (요청자 `user_id`와 레코드 `user_id` 일치 검증)

## 8. 에러 처리
| 상황 | 처리 |
|---|---|
| 이메일 중복 가입 시도 | `409 EMAIL_EXISTS` 반환 |
| 인증 토큰 없음/만료 | `401 UNAUTHORIZED` 반환, 재로그인 유도 |
| 존재하지 않는 레시피 삭제/조회 시도 | `404 NOT_FOUND` |
| 타 사용자 레시피 접근 시도 | `403 FORBIDDEN` |

## 9. 완료 기준 (Definition of Done)
- [ ] 회원가입/로그인 동작
- [ ] 레시피 저장/조회/삭제 API 동작
- [ ] 프로필 선호도가 [[PRD_02]] 레시피 생성 요청에 반영됨
- [ ] 인증/권한 검증 확인 (타 사용자 데이터 접근 차단)

## 10. 전체 파이프라인 요약
[[PRD_01]] (사진 → 식재료 인식) → [[PRD_02]] (식재료 → 레시피 생성) → [[PRD_03]] (레시피 저장 및 프로필 관리)
