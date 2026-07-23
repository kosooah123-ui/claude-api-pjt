// 모델이 배열 하나 대신 "[{...}] [{...}]" 처럼 JSON을 여러 개로 쪼개 응답하는 경우가 있어,
// 최상위 JSON 값(배열/객체) 여러 개를 각각 분리해 파싱한 뒤 하나의 배열로 합친다.
function extractTopLevelJsonChunks(text) {
  const chunks = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '[' || ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        chunks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return chunks;
}

export function parseModelJson(rawText) {
  if (!rawText) return null;
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : rawText;

  const chunks = extractTopLevelJsonChunks(candidate);
  if (chunks.length === 0) return null;

  const values = [];
  for (const chunk of chunks) {
    try {
      values.push(JSON.parse(chunk));
    } catch {
      // 잘린 조각은 건너뛰고 나머지 유효한 조각만 사용한다.
    }
  }
  if (values.length === 0) return null;

  return values.flatMap((v) => (Array.isArray(v) ? v : [v]));
}
