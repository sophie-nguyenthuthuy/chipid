import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import './workers/webhookDelivery.js'; // start the BullMQ worker

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
  logger.info({ port: config.API_PORT }, 'chipid api listening');
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
