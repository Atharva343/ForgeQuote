import { Request, Response } from 'express';

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'success',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'forgequote-api',
      version: '1.0.0',
    },
  });
}

