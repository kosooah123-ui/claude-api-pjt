import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

// 서버 프로세스 재시작 시 모든 세션 토큰은 무효화됨(로컬 프로토타입 한계, 3단계 범위에서는 허용).
const tokenStore = new Map(); // token -> userId

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function createSession(userId) {
  const token = randomUUID();
  tokenStore.set(token, userId);
  return token;
}

export function resolveSession(token) {
  return tokenStore.get(token) || null;
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const userId = token ? resolveSession(token) : null;
  if (!userId) {
    return res.status(401).json({ status: 'error', error_code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' });
  }
  req.userId = userId;
  next();
}
