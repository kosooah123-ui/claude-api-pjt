# PRD_01: 냉장고 사진 인식 (이미지 → 식재료 목록)

## 1. 개요
사용자가 냉장고 내부 사진을 업로드하면, Vision-Language 모델을 이용해 사진 속 식재료를 인식하고 구조화된 목록(JSON)으로 반환하는 기능. 전체 파이프라인(냉장고 사진 → 레시피 추천)의 1단계이며, 이 단계의 출력은 [[PRD_02]] 레시피 생성 단계의 입력으로 사용된다.

## 2. 목표
- 사용자가 냉장고 사진 1장을 업로드하면 식재료 이름 목록을 자동으로 추출한다.
- 인식 결과는 2단계(레시피 생성)가 그대로 소비할 수 있는 고정된 JSON 스키마로 반환한다.

## 3. 범위
### In scope
- 이미지 업로드 UI (드래그 앤 드롭 또는 파일 선택)
- 업로드된 이미지를 OpenRouter API를 통해 Vision 모델로 전달
- 모델 응답을 파싱하여 식재료 목록(이름, 추정 수량/단위, 신뢰도)으로 정규화
- 인식 실패/저품질 사진에 대한 에러 처리 및 재업로드 유도

### Out of scope (다음 단계 또는 향후 과제)
- 레시피 생성 (→ [[PRD_02]])
- 사용자 프로필/저장 (→ [[PRD_03]])
- 유통기한 추적, 바코드 스캔 등 부가 기능

## 4. 사용자 플로우
1. 사용자가 냉장고 내부 사진을 웹앱에 업로드
2. 프론트엔드가 이미지를 백엔드 API로 전송
3. 백엔드가 이미지를 base64 또는 URL로 인코딩하여 OpenRouter Chat Completions API 호출
4. 모델이 이미지 속 식재료를 텍스트로 응답
5. 백엔드가 응답을 파싱해 구조화된 JSON으로 변환 후 프론트엔드에 반환
6. 프론트엔드가 인식된 식재료 목록을 사용자에게 보여주고, 사용자가 오탐지 항목을 수정/삭제/추가할 수 있게 함

## 5. 모델 연동 설계
- **Provider**: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`)
- **Model**: `nvidia/nemotron-nano-12b-v2-vl:free`
  - 참고: 초기 요청 모델명이었던 `nvidia/llama-nemotron-rerank-vl-1b-v2:free`는 OpenRouter 카탈로그에 존재하지 않는 모델 ID로 확인됨(2026-07-23 확인). 실제 연결 테스트(텍스트/이미지 모두 성공)를 거친 `nvidia/nemotron-nano-12b-v2-vl:free`로 대체함. 추후 모델을 변경할 경우 이 문서와 [[PRD_02]]를 함께 갱신할 것.
- **요청 형식**: OpenAI 호환 vision 메시지 포맷
  ```json
  {
    "model": "nvidia/nemotron-nano-12b-v2-vl:free",
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "이 냉장고 사진에 보이는 식재료를 모두 나열해줘. 반드시 JSON 배열로만 응답해." },
          { "type": "image_url", "image_url": { "url": "<base64 data URI 또는 이미지 URL>" } }
        ]
      }
    ]
  }
  ```
- **프롬프트 설계 원칙**: 모델이 자유 서술형 텍스트 대신 고정 스키마의 JSON만 반환하도록 시스템/유저 프롬프트에 출력 형식을 명시. 모델이 스키마를 어길 경우를 대비한 파싱 실패 처리 필요(6절 참고).
- **무료 티어 특성**: 해당 모델은 `:free` 티어로 간헐적 502/504 오류 및 지연이 발생할 수 있음(연결 테스트에서 확인됨). 백엔드에서 1~2회 자동 재시도 로직을 둘 것.

## 6. API 설계 (백엔드)

### `POST /api/fridge/recognize`
**Request**
```json
{
  "image": "<base64 데이터 또는 업로드된 이미지 참조>"
}
```

**Response (성공)**
```json
{
  "status": "ok",
  "ingredients": [
    { "name": "계란", "quantity_estimate": "6개", "confidence": "high" },
    { "name": "우유", "quantity_estimate": "1팩", "confidence": "medium" }
  ]
}
```

**Response (실패 - 모델 오류/타임아웃)**
```json
{
  "status": "error",
  "error_code": "MODEL_UNAVAILABLE",
  "message": "이미지 인식에 실패했습니다. 다시 시도해주세요."
}
```

**Response (실패 - 파싱 불가)**
```json
{
  "status": "error",
  "error_code": "PARSE_FAILURE",
  "message": "모델 응답을 해석할 수 없습니다.",
  "raw_model_output": "..."
}
```

## 7. 데이터 모델 (중간 산출물)
```
Ingredient {
  name: string
  quantity_estimate: string | null
  confidence: "high" | "medium" | "low"
}
```
이 구조는 [[PRD_02]]의 레시피 생성 프롬프트 입력으로 그대로 전달된다.

## 8. 에러 처리
| 상황 | 처리 |
|---|---|
| OpenRouter 502/504/타임아웃 | 최대 2회 자동 재시도(지수 백오프), 이후 실패 시 사용자에게 재업로드 안내 |
| 모델 응답이 JSON 스키마 불일치 | 정규식/느슨한 파싱 1회 시도 → 실패 시 `PARSE_FAILURE` 반환, raw 텍스트를 디버깅용으로 로깅 |
| 이미지 형식 미지원/용량 초과 | 업로드 단계에서 프론트엔드가 사전 검증 (jpg/png, 10MB 이하 등) |
| 인식된 식재료 0개 | "식재료를 인식하지 못했습니다" 안내 + 수동 입력 폼 제공 |

## 9. 완료 기준 (Definition of Done)
- [ ] 이미지 업로드 UI 동작
- [ ] 백엔드가 OpenRouter Vision API 호출 및 응답 파싱 성공
- [ ] 정규화된 `Ingredient[]` JSON을 프론트엔드에 반환
- [ ] 사용자가 인식 결과를 수정할 수 있는 UI 제공
- [ ] 위 에러 케이스에 대한 처리 확인

## 10. 다음 단계
인식된 `Ingredient[]` 목록은 [[PRD_02]] (레시피 생성)의 입력으로 전달된다.
