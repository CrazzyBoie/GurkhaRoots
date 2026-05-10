import jwt from 'jsonwebtoken';

// Read secrets lazily (at call time) so that dotenv.config() has already
// run before these values are captured. Reading them at module-load time
// would grab undefined because ES modules are evaluated before any inline
// code (including dotenv.config()) in the importing file runs.

export const generateAccessToken = (payload) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return jwt.sign(payload, secret, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

export const verifyAccessToken = (token) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not set');
  return jwt.verify(token, secret);
};

export const verifyRefreshToken = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set');
  return jwt.verify(token, secret);
};

export const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken({ userId: user.id }),
  };
};