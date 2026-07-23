import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recognizeFridgeImage, generateRecipes } from './src/services/openrouter.js';
import { parseModelJson } from './src/utils/parseModelJson.js';
import { sanitizeRecipe } from './src/utils/sanitizeText.js';
import { asyncHandler } from './src/utils/asyncHandler.js';
import { hashPassword, verifyPassword, createSession, requireAuth } from './src/services/auth.js';
import {
  getUserByEmail,
  getUserById,
  createUser,
  updateUserPreferences,
  addRecipe,
  getRecipesByUser,
  deleteRecipe,
} from './src/services/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/fridge/recognize', async (req, res) => {
  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ status: 'error', error_code: 'INVALID_IMAGE', message: '이미지 데이터가 없습니다.' });
  }

  let rawOutput;
  try {
    rawOutput = await recognizeFridgeImage(image);
  } catch (err) {
    return res.status(502).json({ status: 'error', error_code: 'MODEL_UNAVAILABLE', message: '이미지 인식에 실패했습니다. 다시 시도해주세요.' });
  }

  const ingredients = parseModelJson(rawOutput);
  if (!Array.isArray(ingredients)) {
    return res.status(502).json({
      status: 'error',
      error_code: 'PARSE_FAILURE',
      message: '모델 응답을 해석할 수 없습니다.',
      raw_model_output: rawOutput,
    });
  }

  return res.json({ status: 'ok', ingredients });
});

app.post('/api/recipe/generate', async (req, res) => {
  const { ingredients, preferences = {}, count = 2 } = req.body;
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ status: 'error', error_code: 'INVALID_INGREDIENTS', message: '식재료 목록이 없습니다.' });
  }

  let rawOutput;
  try {
    rawOutput = await generateRecipes(ingredients, preferences, count);
  } catch (err) {
    return res.status(502).json({ status: 'error', error_code: 'MODEL_UNAVAILABLE', message: '레시피 생성에 실패했습니다. 다시 시도해주세요.' });
  }

  const recipes = parseModelJson(rawOutput);
  if (!Array.isArray(recipes)) {
    return res.status(502).json({
      status: 'error',
      error_code: 'PARSE_FAILURE',
      message: '모델 응답을 해석할 수 없습니다.',
      raw_model_output: rawOutput,
    });
  }

  return res.json({ status: 'ok', recipes: recipes.map(sanitizeRecipe) });
});

app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ status: 'error', error_code: 'INVALID_INPUT', message: '이메일과 비밀번호가 필요합니다.' });
  }
  if (await getUserByEmail(email)) {
    return res.status(409).json({ status: 'error', error_code: 'EMAIL_EXISTS', message: '이미 가입된 이메일입니다.' });
  }

  const user = await createUser({
    id: randomUUID(),
    email,
    password_hash: hashPassword(password),
    created_at: new Date().toISOString(),
    preferences: { allergies: [], difficulty: null },
  });

  return res.json({ status: 'ok', user_id: user.id });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ status: 'error', error_code: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const token = createSession(user.id);
  return res.json({ status: 'ok', token });
}));

app.get('/api/profile', requireAuth, asyncHandler(async (req, res) => {
  const user = await getUserById(req.userId);
  if (!user) return res.status(404).json({ status: 'error', error_code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' });
  return res.json({ status: 'ok', email: user.email, preferences: user.preferences });
}));

app.patch('/api/profile/preferences', requireAuth, asyncHandler(async (req, res) => {
  const { allergies, difficulty } = req.body;
  const updated = await updateUserPreferences(req.userId, {
    ...(allergies !== undefined ? { allergies } : {}),
    ...(difficulty !== undefined ? { difficulty } : {}),
  });
  return res.json({ status: 'ok', preferences: updated.preferences });
}));

app.post('/api/recipes', requireAuth, asyncHandler(async (req, res) => {
  const recipe = req.body;
  if (!recipe || !recipe.title) {
    return res.status(400).json({ status: 'error', error_code: 'INVALID_RECIPE', message: '레시피 데이터가 올바르지 않습니다.' });
  }

  const saved = await addRecipe({
    id: randomUUID(),
    user_id: req.userId,
    title: recipe.title,
    used_ingredients: recipe.used_ingredients || [],
    missing_ingredients: recipe.missing_ingredients || [],
    steps: recipe.steps || [],
    estimated_time_minutes: recipe.estimated_time_minutes ?? null,
    difficulty: recipe.difficulty ?? null,
    saved_at: new Date().toISOString(),
  });

  return res.json({ status: 'ok', saved_recipe_id: saved.id });
}));

app.get('/api/recipes', requireAuth, asyncHandler(async (req, res) => {
  return res.json({ status: 'ok', recipes: await getRecipesByUser(req.userId) });
}));

app.delete('/api/recipes/:id', requireAuth, asyncHandler(async (req, res) => {
  const result = await deleteRecipe(req.params.id, req.userId);
  if (result === 'not_found') {
    return res.status(404).json({ status: 'error', error_code: 'NOT_FOUND', message: '레시피를 찾을 수 없습니다.' });
  }
  if (result === 'forbidden') {
    return res.status(403).json({ status: 'error', error_code: 'FORBIDDEN', message: '접근 권한이 없습니다.' });
  }
  return res.json({ status: 'ok' });
}));

app.listen(PORT, () => {
  console.log(`Fridge recipe app listening on http://localhost:${PORT}`);
});

export default app;
