const mongoose = require('mongoose');
const logger = require('./logger');
const { mongoUri } = require('../config/environment');

mongoose.set('strictQuery', false);

let connectionPromise = null;

function maskMongoUri(uri) {
  if (!uri) {
    return '';
  }
  return uri.replace(/:\/\/(.*?):(.*?)@/, '://<username>:<password>@');
}

async function connectDB() {
  if (connectionPromise) {
    return connectionPromise;
  }

  if (!mongoUri) {
    throw new Error('未配置 MongoDB 连接字符串，请设置 MONGODB_URI 环境变量');
  }

  logger.info(`Connecting to MongoDB ${maskMongoUri(mongoUri)}`);

  connectionPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    })
    .then((connection) => {
      logger.info('MongoDB connected successfully');
      return connection;
    })
    .catch((error) => {
      connectionPromise = null;
      logger.error('MongoDB connection failed', error);
      throw error;
    });

  return connectionPromise;
}

module.exports = connectDB;
