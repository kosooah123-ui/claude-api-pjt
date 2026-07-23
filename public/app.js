// --- 인증 ---
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const signupBtn = document.getElementById('signupBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authStatus = document.getElementById('authStatus');
const loggedOutView = document.getElementById('loggedOutView');
const loggedInView = document.getElementById('loggedInView');
const loggedInEmail = document.getElementById('loggedInEmail');
const savedRecipesStatus = document.getElementById('savedRecipesStatus');
const savedRecipeList = document.getElementById('savedRecipeList');

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function updateAuthView() {
  const token = getToken();
  const email = localStorage.getItem('email');
  loggedOutView.hidden = Boolean(token);
  loggedInView.hidden = !token;
  if (token) {
    loggedInEmail.textContent = email || '로그인됨';
    loadSavedRecipes();
  } else {
    savedRecipeList.innerHTML = '';
  }
}

signupBtn.addEventListener('click', async () => {
  authStatus.style.color = '#666';
  authStatus.textContent = '회원가입 중...';
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail.value, password: authPassword.value }),
    });
    const data = await res.json();
    if (data.status !== 'ok') {
      authStatus.style.color = '#b91c1c';
      authStatus.textContent = data.message || '회원가입에 실패했습니다.';
      return;
    }
    authStatus.style.color = '#16a34a';
    authStatus.textContent = '회원가입 완료! 로그인해주세요.';
  } catch {
    authStatus.style.color = '#b91c1c';
    authStatus.textContent = '네트워크 오류가 발생했습니다.';
  }
});

loginBtn.addEventListener('click', async () => {
  authStatus.style.color = '#666';
  authStatus.textContent = '로그인 중...';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail.value, password: authPassword.value }),
    });
    const data = await res.json();
    if (data.status !== 'ok') {
      authStatus.style.color = '#b91c1c';
      authStatus.textContent = data.message || '로그인에 실패했습니다.';
      return;
    }
    localStorage.setItem('token', data.token);
    localStorage.setItem('email', authEmail.value);
    authStatus.textContent = '';
    updateAuthView();
  } catch {
    authStatus.style.color = '#b91c1c';
    authStatus.textContent = '네트워크 오류가 발생했습니다.';
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  updateAuthView();
});

async function loadSavedRecipes() {
  savedRecipesStatus.textContent = '불러오는 중...';
  savedRecipeList.innerHTML = '';
  try {
    const res = await fetch('/api/recipes', { headers: authHeaders() });
    const data = await res.json();
    if (data.status !== 'ok') {
      savedRecipesStatus.style.color = '#b91c1c';
      savedRecipesStatus.textContent = data.message || '목록을 불러오지 못했습니다.';
      return;
    }
    savedRecipesStatus.textContent = data.recipes.length === 0 ? '저장된 레시피가 없습니다.' : '';
    data.recipes.forEach(renderSavedRecipe);
  } catch {
    savedRecipesStatus.style.color = '#b91c1c';
    savedRecipesStatus.textContent = '네트워크 오류가 발생했습니다.';
  }
}

function renderSavedRecipe(recipe) {
  const card = document.createElement('div');
  card.className = 'saved-recipe-card';

  const info = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = recipe.title;
  const meta = document.createElement('div');
  meta.className = 'saved-meta';
  meta.textContent = `저장일: ${new Date(recipe.saved_at).toLocaleString()}`;
  info.append(title, meta);

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '삭제';
  deleteBtn.className = 'remove-btn';
  deleteBtn.addEventListener('click', async () => {
    await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE', headers: authHeaders() });
    loadSavedRecipes();
  });

  card.append(info, deleteBtn);
  savedRecipeList.appendChild(card);
}

updateAuthView();

const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const recognizeBtn = document.getElementById('recognizeBtn');
const statusEl = document.getElementById('status');
const resultSection = document.getElementById('resultSection');
const ingredientList = document.getElementById('ingredientList');
const addIngredientBtn = document.getElementById('addIngredientBtn');

let imageDataUrl = null;

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    imageDataUrl = reader.result;
    preview.src = imageDataUrl;
    preview.hidden = false;
    recognizeBtn.disabled = false;
    statusEl.textContent = '';
  };
  reader.readAsDataURL(file);
});

function renderIngredient(ingredient) {
  const li = document.createElement('li');

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = ingredient.name || '';
  nameInput.placeholder = '재료 이름';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'text';
  qtyInput.value = ingredient.quantity_estimate || '';
  qtyInput.placeholder = '수량';
  qtyInput.style.maxWidth = '100px';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '삭제';
  removeBtn.className = 'remove-btn';
  removeBtn.addEventListener('click', () => li.remove());

  li.appendChild(nameInput);
  li.appendChild(qtyInput);
  if (ingredient.confidence === 'low') {
    const badge = document.createElement('span');
    badge.className = 'confidence-low';
    badge.textContent = '(신뢰도 낮음)';
    li.appendChild(badge);
  }
  li.appendChild(removeBtn);

  ingredientList.appendChild(li);
}

addIngredientBtn.addEventListener('click', () => {
  renderIngredient({ name: '', quantity_estimate: '', confidence: 'high' });
});

const generateRecipeBtn = document.getElementById('generateRecipeBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const recipeStatus = document.getElementById('recipeStatus');
const recipeSection = document.getElementById('recipeSection');
const recipeList = document.getElementById('recipeList');
const allergiesInput = document.getElementById('allergiesInput');
const difficultyInput = document.getElementById('difficultyInput');

function collectIngredientsFromUI() {
  return Array.from(ingredientList.querySelectorAll('li'))
    .map((li) => {
      const [nameInput, qtyInput] = li.querySelectorAll('input[type="text"]');
      return { name: nameInput.value.trim(), quantity_estimate: qtyInput.value.trim() || null };
    })
    .filter((i) => i.name);
}

function renderRecipe(recipe) {
  const card = document.createElement('div');
  card.className = 'recipe-card';

  const title = document.createElement('h3');
  title.textContent = recipe.title || '(제목 없음)';

  const meta = document.createElement('div');
  meta.className = 'recipe-meta';
  meta.textContent = `예상 조리 시간: ${recipe.estimated_time_minutes ?? '?'}분 · 난이도: ${recipe.difficulty ?? '?'}`;

  const used = document.createElement('p');
  used.textContent = `사용 재료: ${(recipe.used_ingredients || []).join(', ') || '-'}`;

  const missing = document.createElement('p');
  missing.className = 'missing';
  const missingItems = recipe.missing_ingredients || [];
  missing.textContent = missingItems.length ? `추가로 필요한 재료: ${missingItems.join(', ')}` : '';

  const stepsTitle = document.createElement('p');
  stepsTitle.textContent = '조리 순서:';

  const stepsList = document.createElement('ol');
  (recipe.steps || []).forEach((step) => {
    const li = document.createElement('li');
    li.textContent = step;
    stepsList.appendChild(li);
  });

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '이 레시피 저장하기';
  saveBtn.className = 'save-recipe-btn';
  saveBtn.addEventListener('click', async () => {
    if (!getToken()) {
      saveBtn.textContent = '로그인이 필요합니다';
      setTimeout(() => (saveBtn.textContent = '이 레시피 저장하기'), 2000);
      return;
    }
    saveBtn.disabled = true;
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(recipe),
      });
      const data = await res.json();
      saveBtn.textContent = data.status === 'ok' ? '저장됨 ✓' : '저장 실패';
      if (data.status === 'ok') loadSavedRecipes();
    } finally {
      saveBtn.disabled = false;
    }
  });

  card.append(title, meta, used, missing, stepsTitle, stepsList, saveBtn);
  recipeList.appendChild(card);
}

async function requestRecipes() {
  const ingredients = collectIngredientsFromUI();
  if (ingredients.length === 0) {
    recipeStatus.style.color = '#b91c1c';
    recipeStatus.textContent = '식재료 목록이 비어 있습니다.';
    return;
  }

  const preferences = {
    allergies: allergiesInput.value.split(',').map((s) => s.trim()).filter(Boolean),
    difficulty: difficultyInput.value || undefined,
  };

  generateRecipeBtn.disabled = true;
  regenerateBtn.disabled = true;
  recipeStatus.style.color = '#666';
  recipeStatus.textContent = '레시피를 생성 중입니다...';
  recipeList.innerHTML = '';
  recipeSection.hidden = true;

  try {
    const res = await fetch('/api/recipe/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, preferences, count: 2 }),
    });
    const data = await res.json();

    if (data.status !== 'ok') {
      recipeStatus.style.color = '#b91c1c';
      recipeStatus.textContent = data.message || '레시피 생성에 실패했습니다.';
      return;
    }

    recipeStatus.textContent = '';
    recipeSection.hidden = false;
    regenerateBtn.hidden = false;
    data.recipes.forEach(renderRecipe);
  } catch (err) {
    recipeStatus.style.color = '#b91c1c';
    recipeStatus.textContent = '네트워크 오류가 발생했습니다.';
  } finally {
    generateRecipeBtn.disabled = false;
    regenerateBtn.disabled = false;
  }
}

generateRecipeBtn.addEventListener('click', requestRecipes);
regenerateBtn.addEventListener('click', requestRecipes);

recognizeBtn.addEventListener('click', async () => {
  if (!imageDataUrl) return;

  recognizeBtn.disabled = true;
  statusEl.style.color = '#666';
  statusEl.textContent = '인식 중입니다... (최대 수십 초 소요될 수 있어요)';
  ingredientList.innerHTML = '';
  resultSection.hidden = true;

  try {
    const res = await fetch('/api/fridge/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl }),
    });
    const data = await res.json();

    if (data.status !== 'ok') {
      statusEl.style.color = '#b91c1c';
      statusEl.textContent = data.message || '인식에 실패했습니다.';
      return;
    }

    statusEl.textContent = '';
    resultSection.hidden = false;

    if (data.ingredients.length === 0) {
      statusEl.style.color = '#b45309';
      statusEl.textContent = '식재료를 인식하지 못했습니다. 직접 추가해주세요.';
    }

    data.ingredients.forEach(renderIngredient);
  } catch (err) {
    statusEl.style.color = '#b91c1c';
    statusEl.textContent = '네트워크 오류가 발생했습니다.';
  } finally {
    recognizeBtn.disabled = false;
  }
});
