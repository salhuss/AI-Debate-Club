import rateLimit from 'express-rate-limit';
import { enforceGuardrail } from './guardrail.js';
/**
 * src/server.ts
 * ----------------------------------------------------------------------------
 * Production/dev entrypoint. Imports the testable app and starts listening.
 */
import { app } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'api listening');
});
