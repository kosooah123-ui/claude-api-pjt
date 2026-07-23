// 한글 음절/숫자/기본 구두점 이외의 문자(아랍어, 키릴, 태국어, 한자, 로마자 코드 조각 등 모델 환각으로 섞이는 문자)를 제거한다.
const ALLOWED_CHARS = /[^가-힣0-9\s.,!?()%~\-/·:]/g;

export function sanitizeKoreanText(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(ALLOWED_CHARS, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return recipe;
  return {
    ...recipe,
    title: sanitizeKoreanText(recipe.title),
    used_ingredients: (recipe.used_ingredients || []).map(sanitizeKoreanText).filter(Boolean),
    missing_ingredients: (recipe.missing_ingredients || []).map(sanitizeKoreanText).filter(Boolean),
    steps: (recipe.steps || []).map(sanitizeKoreanText).filter(Boolean),
  };
}
