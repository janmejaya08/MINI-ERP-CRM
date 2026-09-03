import crypto from 'crypto';

const SECRET_KEY = process.env.JWT_SECRET || 'super_secret_erp_key_2026';

export const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export const generateToken = (payload: object): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
};

export const verifyToken = (token: string): any => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) return null;
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
};