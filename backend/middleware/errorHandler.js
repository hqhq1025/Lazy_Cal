const logger = require('../utils/logger');

function notFoundHandler(req, res, next) {
  res.status(404).json({
    message: '未找到请求的接口',
    path: req.originalUrl
  });
}

function errorHandler(err, req, res, next) {
  logger.error('Request processing failed', err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.status && Number.isInteger(err.status)) {
    return res.status(err.status).json({ message: err.message });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message, details: err.errors });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: '无效的资源标识符' });
  }

  res.status(500).json({ message: '服务器内部错误，请稍后重试' });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
