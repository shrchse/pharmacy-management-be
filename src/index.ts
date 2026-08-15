import app from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  console.log(`📡 Health Check available at http://localhost:${env.PORT}/api/v1/health`);
});

const gracefulShutdown = async (signal: string) => {
  console.log(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('🔒 HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('🔌 Prisma client disconnected cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during Prisma disconnect:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
