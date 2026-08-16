import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  DomainError,
  InvalidPickupCodeError,
  LockerEmptyError,
  LockerNotFoundError,
  NoSuitableLockerError,
  OrderAlreadyStoredError,
  OrderNotFoundError,
} from '../domain/errors.js';

function statusFor(error: DomainError): number {
  if (error instanceof LockerNotFoundError) return 404;
  if (error instanceof OrderNotFoundError) return 404;
  if (error instanceof NoSuitableLockerError) return 409;
  if (error instanceof OrderAlreadyStoredError) return 409;
  if (error instanceof InvalidPickupCodeError) return 422;
  if (error instanceof LockerEmptyError) return 422;
  return 422;
}

/** Maps domain and validation errors onto the API's error shape. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  // Express identifies error middleware by arity, so `next` must be declared.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues
          .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
          .join('; '),
      },
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(statusFor(error)).json({ error: { code: error.code, message: error.message } });
    return;
  }

  console.error('Unexpected error', error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}
