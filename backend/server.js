const app = require('./app');
const connectDB = require('./utils/mongodb');
const logger = require('./utils/logger');
const { port } = require('./config/environment');

async function bootstrap() {
  try {
    await connectDB();
    app.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

bootstrap();

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});
