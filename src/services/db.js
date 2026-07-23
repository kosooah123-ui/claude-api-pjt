import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const DB_DIR = path.resolve('data');
const DB_FILE = path.join(DB_DIR, 'db.json');

function ensureDb() {
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) {
    writeFileSync(DB_FILE, JSON.stringify({ users: [], recipes: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(readFileSync(DB_FILE, 'utf8'));
}

function writeDb(data) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export function getUserByEmail(email) {
  return readDb().users.find((u) => u.email === email) || null;
}

export function getUserById(id) {
  return readDb().users.find((u) => u.id === id) || null;
}

export function createUser(user) {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return user;
}

export function updateUserPreferences(id, preferences) {
  const db = readDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  user.preferences = { ...user.preferences, ...preferences };
  writeDb(db);
  return user;
}

export function addRecipe(recipe) {
  const db = readDb();
  db.recipes.push(recipe);
  writeDb(db);
  return recipe;
}

export function getRecipesByUser(userId) {
  return readDb().recipes.filter((r) => r.user_id === userId);
}

export function getRecipeById(id) {
  return readDb().recipes.find((r) => r.id === id) || null;
}

export function deleteRecipe(id, userId) {
  const db = readDb();
  const idx = db.recipes.findIndex((r) => r.id === id);
  if (idx === -1) return 'not_found';
  if (db.recipes[idx].user_id !== userId) return 'forbidden';
  db.recipes.splice(idx, 1);
  writeDb(db);
  return 'ok';
}
