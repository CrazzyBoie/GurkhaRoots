import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.service.js';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// NOTE: sameSite must be 'lax' (not 'strict') so cookies are sent after the
// cross-site redirect that Google performs back to our callback URL.
// In production with HTTPS, use 'none' + secure: true.
const accessTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 15 * 60 * 1000,
};

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req, res) => {
  try {
    const { name, email, password, phone } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        phone,
        role: 'customer',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie('accessToken', accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

    sendWelcomeEmail(user).catch(console.error);

    res.status(201).json({
      message: 'Registration successful',
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie('accessToken', accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await prisma.user.updateMany({
        where: { refreshToken },
        data: { refreshToken: null },
      });
    }

    // Must pass the same path/sameSite/secure options used when setting the cookie,
    // otherwise the browser ignores the clear instruction.
    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    };
    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
};

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token' });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        refreshToken,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    res.cookie('accessToken', tokens.accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', tokens.refreshToken, refreshTokenCookieOptions);

    res.json({ message: 'Token refreshed' });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    console.log('[googleCallback] req.user:', user ? `id=${user.id} email=${user.email}` : 'UNDEFINED — passport auth failed');

    if (!user) {
      console.error('[googleCallback] No user on req — redirecting to login with error');
      return res.redirect(`${process.env.CLIENT_URL}/login?error=google_auth_failed`);
    }

    const { accessToken, refreshToken } = generateTokens(user);
    console.log('[googleCallback] Tokens generated, redirecting to:', `${process.env.CLIENT_URL}/auth/callback#token=<jwt>`);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie('accessToken', accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

    // Pass the access token in the URL hash — hash fragments are never sent to
    // any server, so the token won't appear in logs. This works cross-origin
    // (port 5173 ↔ 5000) where cookies would be blocked by the browser.
    res.redirect(`${process.env.CLIENT_URL}/auth/callback#token=${accessToken}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !z.string().email().safeParse(email).success) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.json({ message: 'If an account exists, a reset email has been sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: `reset:${resetToken}:${resetTokenExpiry.getTime()}`,
      },
    });

    await sendPasswordResetEmail(user, resetToken);

    res.json({ message: 'If an account exists, a reset email has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to process request' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const users = await prisma.user.findMany({
      where: {
        refreshToken: {
          startsWith: `reset:${token}:`,
        },
      },
    });

    const user = users.find(u => {
      const parts = u.refreshToken?.split(':');
      return parts && parts.length === 3 && parts[1] === token;
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const parts = user.refreshToken.split(':');
    const expiry = parseInt(parts[2]);

    if (Date.now() > expiry) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        refreshToken: null,
      },
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id || req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
};