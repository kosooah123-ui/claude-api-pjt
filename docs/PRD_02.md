# PRD_02: 레시피 생성 (식재료 목록 → 레시피)

## 1. 개요
[[PRD_01]]에서 인식된 식재료 목록(`Ingredient[]`)을 입력받아, 텍스트 생성 모델로 해당 재료를 활용한 레시피를 추천하는 기능. 이 단계의 출력(레시피)은 [[PRD_03]]에서 사용자 프로필에 저장되는 대상이 된다.

## 2. 목표
- 인식된 식재료를 기반으로 실현 가능한 레시피 1~3개를 생성한다.
- 레시피는 제목, 재료(보유/추가 필요 구분), 조리 순서, 예상 조리 시간을 포함한 구조화된 형식으로 제공한다.

## 3. 범위
### In scope
- [[PRD_01]] 결과(`Ingredient[]`) + 선택적 사용자 선호도(알레르기, 식단 제한, 조리 난이도 등)를 프롬프트로 구성
- OpenRouter 텍스트 생성 호출 및 응답을 구조화된 레시피 JSON으로 파싱
- 프론트엔드에 레시피 카드 형태로 표시
- 레시피 재생성(다른 레시피 요청) 기능

### Out of scope
- 이미지 인식 자체 (→ [[PRD_01]])
- 레시피 저장/사용자 프로필 (→ [[PRD_03]])
- 영양 정보 계산, 쇼핑 리스트 자동 생성 등 부가 기능

## 4. 사용자 플로우
1. [[PRD_01]]에서 인식/수정된 식재료 목록을 사용자가 확인 후 "레시피 추천받기" 클릭
2. (선택) 사용자가 알레르기, 선호 요리 종류, 난이도 등 필터 입력
3. 백엔드가 식재료 목록 + 필터를 프롬프트로 구성하여 OpenRouter 텍스트 API 호출
4. 모델이 레시피(제목/재료/조리법/시간)를 JSON으로 응답
5. 프론트엔드가 레시피 카드를 표시, 사용자가 마음에 드는 레시피를 저장 가능 (→ [[PRD_03]])

## 5. 모델 연동 설계
- **Provider**: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
- **Model**: `nvidia/nemotron-nano-12b-v2-vl:free` ([[PRD_01]]과 동일 모델로 통일, 텍스트 전용 호출이므로 `image_url` 없이 텍스트 메시지만 전달)
  - 참고: 초기 요청된 `nvidia/llama-nemotron-rerank-vl-1b-v2:free`는 존재하지 않는 모델 ID이므로 검증된 모델로 대체함 ([[PRD_01]] 5절 참고).
- **요청 형식 예시**
  ```json
  {
    "model": "nvidia/nemotron-nano-12b-v2-vl:free",
    "messages": [
      {
        "role": "system",
        "content": "너는 냉장고 속 재료로 레시피를 추천하는 어시스턴트야. 반드시 지정된 JSON 스키마로만 응답해."
      },
      {
        "role": "user",
        "content": "보유 재료: 계란, 우유, 대파. 알레르기: 없음. 난이도: 쉬움. 위 재료로 만들 수 있는 레시피 2개를 추천해줘."
      }
    ]
  }
  ```
- **출력 스키마 강제**: 시스템 프롬프트에 JSON 스키마를 명시하고, 가능하면 OpenRouter의 `response_format: { type: "json_object" }` 옵션(모델 지원 여부 확인 필요) 사용을 시도. 미지원 시 프롬프트 강제 + 파싱 실패 대응 로직으로 대체.
- **무료 티어 특성**: [[PRD_01]]과 동일하게 간헐적 502/504 발생 가능 → 재시도 로직 공유.

## 6. API 설계

### `POST /api/recipe/generate`
**Request**
```json
{
  "ingredients": [
    { "name": "계란", "quantity_estimate": "6개" },
    { "name": "우유", "quantity_estimate": "1팩" }
  ],
  "preferences": {
    "allergies": [],
    "difficulty": "easy",
    "cuisine": null
  },
  "count": 2
}
```

**Response (성공)**
```json
{
  "status": "ok",
  "recipes": [
    {
      "title": "계란 우유 스크램블",
      "used_ingredients": ["계란", "우유"],
      "missing_ingredients": ["버터", "소금"],
      "steps": ["팬을 예열한다", "계란과 우유를 섞는다", "약불에서 저어가며 익힌다"],
      "estimated_time_minutes": 10,
      "difficulty": "easy"
    }
  ]
}
```

**Response (실패)**
```json
{
  "status": "error",
  "error_code": "MODEL_UNAVAILABLE" ,
  "message": "레시피 생성에 실패했습니다. 다시 시도해주세요."
}
```

### `POST /api/recipe/regenerate`
동일한 입력에 대해 다른 레시피를 재요청 (내부적으로 `generate`와 동일 로직 + 이전 결과 제외 프롬프트 추가).

## 7. 데이터 모델
```
Recipe {
  title: string
  used_ingredients: string[]
  missing_ingredients: string[]
  steps: string[]
  estimated_time_minutes: number
  difficulty: "easy" | "medium" | "hard"
}
```
이 구조는 [[PRD_03]]에서 사용자 프로필에 저장되는 레코드의 기본 단위가 된다.

## 8. 에러 처리
| 상황 | 처리 |
|---|---|
| OpenRouter 502/504/타임아웃 | 최대 2회 자동 재시도, 실패 시 사용자에게 재시도 버튼 제공 |
| 모델 응답이 JSON 스키마 불일치 | 파싱 재시도 → 실패 시 `PARSE_FAILURE`, raw 응답 로깅 |
| 입력 재료가 0개 | 요청 자체를 막고 [[PRD_01]]로 리다이렉트 안내 |
| 재료만으로 레시피 불가 판단 | 모델이 "재료 부족" 판단 시 `missing_ingredients`를 충분히 채워 반환하도록 프롬프트에 명시 |

## 9. 완료 기준 (Definition of Done)
- [ ] `Ingredient[]` + 선호도 입력 → 레시피 JSON 응답 성공
- [ ] 레시피 카드 UI 표시
- [ ] 재생성(다른 레시피 요청) 기능 동작
- [ ] 에러 케이스 처리 확인

## 10. 다음 단계
생성된 `Recipe` 객체는 사용자가 저장을 원할 경우 [[PRD_03]] (사용자 프로필 및 저장)으로 전달된다.
