import 'dotenv/config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'nvidia/nemotron-nano-12b-v2-vl:free';
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenRouter(messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, messages }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        lastError = json.error || { message: `HTTP ${res.status}` };
        await sleep(500 * (attempt + 1));
        continue;
      }
      return json.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      lastError = { message: err.message };
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`OpenRouter request failed after retries: ${JSON.stringify(lastError)}`);
}

export async function recognizeFridgeImage(imageDataUrl) {
  const content = await callOpenRouter([
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text:
            '이 냉장고 사진에 보이는 식재료를 모두 나열해줘. ' +
            '반드시 아래 JSON 스키마의 배열만 응답하고, 다른 설명은 붙이지 마: ' +
            '[{"name": "식재료 이름", "quantity_estimate": "추정 수량 또는 null", "confidence": "high|medium|low"}]',
        },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ]);
  return content;
}

export async function generateRecipes(ingredients, preferences = {}, count = 2) {
  const ingredientList = ingredients.map((i) => i.name).join(', ');
  const allergyLine = (preferences.allergies || []).length
    ? `알레르기 재료(반드시 피할 것): ${preferences.allergies.join(', ')}`
    : '';
  const difficultyLine = preferences.difficulty
    ? `원하는 난이도: ${preferences.difficulty}`
    : '';

  const content = await callOpenRouter([
    {
      role: 'system',
      content: [
        '너는 냉장고 속 재료로 레시피를 추천하는 어시스턴트야.',
        '반드시 한국어로만 답하고, 영어 알파벳이나 로마자, 아랍어 등 다른 언어 문자를 단 하나도 섞지 마.',
        '"무관", "중간", "미디엄" 같은 난이도/선호도 관련 단어나 같은 문구를 반복해서 넣지 마.',
        'title은 15자 이내의 간단한 요리 이름만 적고, 괄호나 부연 설명을 붙이지 마.',
        'missing_ingredients의 각 항목은 재료 이름 하나만 담고 (예: "소금", "식용유"), 보유 재료 목록에 이미 있는 재료는 절대 넣지 마.',
        'steps는 실제 조리 동작만 순서대로 적고, 마지막에 재료 목록을 다시 나열하는 문장을 넣지 마.',
        'steps 배열은 최대 4개까지만 적고, 각 단계 문장은 20자를 넘지 않는 짧고 간단한 문장으로 적어.',
        '요청받은 개수만큼 정확히 레시피를 생성해.',
        '반드시 아래 JSON 스키마의 배열만 응답하고, 그 외 설명이나 마크다운은 붙이지 마:',
        '[{"title": "...", "used_ingredients": ["..."], "missing_ingredients": ["..."], "steps": ["..."], "estimated_time_minutes": 0, "difficulty": "easy|medium|hard"}]',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `보유 재료: ${ingredientList}.`,
        allergyLine,
        difficultyLine,
        `위 재료로 만들 수 있는 레시피 ${count}개를 추천해줘.`,
      ]
        .filter(Boolean)
        .join(' '),
    },
  ]);
  return content;
}
