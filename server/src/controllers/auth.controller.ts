import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { loginSchema } from '../validators/auth.validator';
import { env } from '../config/env';

const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export class AuthController {
  /**
   * POST /api/auth/login
   * Validates credentials, sets HTTP-only cookie, and returns safe user data.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = loginSchema.parse(req.body);
      const { token, user } = await authService.login(validatedInput);

      // Set secure HTTP-only cookie
      const isProd = env.NODE_ENV === 'production';
      res.cookie(env.AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE_MS,
      });

      res.status(200).json({
        status: 'success',
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Returns current authenticated user profile.
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required. Please log in.',
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Clears the HTTP-only cookie and ends the session.
   */
  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isProd = env.NODE_ENV === 'production';
      res.clearCookie(env.AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
      });

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

