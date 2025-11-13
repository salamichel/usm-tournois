import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    const logLevel = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';

    console.log(
      `${logLevel} ${method} ${originalUrl} - ${statusCode} (${duration}ms)`
    );
  });

  next();
};
