import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { LoginInput } from '../validators/auth.validator';
import { AppError } from '../middleware/errorHandler';

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResult {
  token: string;
  user: SafeUser;
}

export class AuthService {
  /**
   * Authenticates user credentials and generates a signed JWT.
   */
  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    if (!user.isActive) {
      const error: AppError = new Error('Account is deactivated. Please contact your administrator.');
      error.statusCode = 401;
      throw error;
    }

    const payload: TokenPayload = {
      userId: user.id,
      role: user.role,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Fetches the current authenticated user by ID and verifies active status.
   */
  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      const error: AppError = new Error('User session is invalid or account is deactivated.');
      error.statusCode = 401;
      throw error;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Verifies and decodes a signed JWT.
   */
  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      return decoded;
    } catch {
      const error: AppError = new Error('Invalid or expired authentication session.');
      error.statusCode = 401;
      throw error;
    }
  }
}

export const authService = new AuthService();

