import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestId(headerName = 'x-request-id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header(headerName) || randomUUID();
    (req as any).requestId = incoming;
    res.setHeader(headerName, incoming);
    next();
  };
}
