import path from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';
import type { Express } from 'express';
import { apiRoutes } from './routes.js';
import type { ApiDependencies } from './routes.js';
import { errorHandler } from './errorHandler.js';

export interface AppOptions {
  /** When set (production), the built web UI is served from this directory. */
  webDistPath?: string;
}

export function createApp(deps: ApiDependencies, options: AppOptions = {}): Express {
  const app = express();
  app.use(express.json());

  app.use('/api', apiRoutes(deps));

  if (options.webDistPath !== undefined && existsSync(options.webDistPath)) {
    app.use(express.static(options.webDistPath));
    // SPA fallback: any non-API GET serves the UI entry point.
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(options.webDistPath as string, 'index.html'));
        return;
      }
      next();
    });
  }

  app.use(errorHandler);

  return app;
}
