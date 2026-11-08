import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { authService, SafeUser } from '../services/auth.service';
import { env } from '../config/env';

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

/**
 * Validates Origin header on state-changing requests to protect cookie sessions.
 */
function validateOrigin(req: Request, res: Response): boolean {
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isStateChanging) return true;

  const origin = req.headers.origin;
  // If Origin is present, ensure it matches allowed CLIENT_ORIGIN
  if (origin && origin !== env.CLIENT_ORIGIN) {
    res.status(403).json({
      status: 'error',
      message: 'Forbidden: Request origin does not match allowed client origin.',
    });
    return false;
  }
  return true;
}

/**
 * Middleware: Requires a valid authenticated session via HTTP-only cookie or Bearer token.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!validateOrigin(req, res)) {
      return;
    }

    // 1. Extract token from cookie (primary) or Authorization header (fallback for API tooling)
    let token = req.cookies?.[env.AUTH_COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please log in.',
      });
      return;
    }

    // 2. Verify token signature and expiration
    const payload = authService.verifyToken(token);

    // 3. Verify user still exists and isActive in database
    const user = await authService.getCurrentUser(payload.userId);

    // 4. Attach safe user object to request
    req.user = user;
    next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid or expired authentication session.';
    res.status(401).json({
      status: 'error',
      message,
    });
  }
}

/**
 * Middleware: Requires the authenticated user to hold one of the designated roles.
 * Returns HTTP 403 if unauthorized.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please log in.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        message: 'Forbidden: You do not have permission to access this resource.',
      });
      return;
    }

    next();
  };
}

