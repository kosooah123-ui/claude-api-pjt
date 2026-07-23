import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    created_at: row.created_at,
    preferences: {
      allergies: row.allergies ?? [],
      difficulty: row.difficulty ?? null,
    },
  };
}

export async function getUserByEmail(email) {
  const { data, error } = await supabase.from('users_tbl').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return toUser(data);
}

export async function getUserById(id) {
  const { data, error } = await supabase.from('users_tbl').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return toUser(data);
}

export async function createUser(user) {
  const { data, error } = await supabase
    .from('users_tbl')
    .insert({
      id: user.id,
      email: user.email,
      password_hash: user.password_hash,
      created_at: user.created_at,
      allergies: user.preferences?.allergies ?? [],
      difficulty: user.preferences?.difficulty ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toUser(data);
}

export async function updateUserPreferences(id, preferences) {
  const update = {};
  if (preferences.allergies !== undefined) update.allergies = preferences.allergies;
  if (preferences.difficulty !== undefined) update.difficulty = preferences.difficulty;

  const { data, error } = await supabase.from('users_tbl').update(update).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return toUser(data);
}

export async function addRecipe(recipe) {
  const { data, error } = await supabase
    .from('recipes_tbl')
    .insert({
      id: recipe.id,
      user_id: recipe.user_id,
      title: recipe.title,
      used_ingredients: recipe.used_ingredients,
      missing_ingredients: recipe.missing_ingredients,
      steps: recipe.steps,
      estimated_time_minutes: recipe.estimated_time_minutes,
      difficulty: recipe.difficulty,
      saved_at: recipe.saved_at,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRecipesByUser(userId) {
  const { data, error } = await supabase
    .from('recipes_tbl')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRecipeById(id) {
  const { data, error } = await supabase.from('recipes_tbl').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteRecipe(id, userId) {
  const existing = await getRecipeById(id);
  if (!existing) return 'not_found';
  if (existing.user_id !== userId) return 'forbidden';

  const { error } = await supabase.from('recipes_tbl').delete().eq('id', id);
  if (error) throw error;
  return 'ok';
}
