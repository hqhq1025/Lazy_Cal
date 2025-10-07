const express = require('express');
const cors = require('cors');
const coursesRoute = require('./api/courses');
const schedulesRoute = require('./routes/schedules');
const healthRoute = require('./routes/health');
const authRoute = require('./auth');
const { corsOrigins, jsonLimit } = require('./config/environment');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const securityHeaders = require('./middleware/securityHeaders');

const app = express();

app.use(securityHeaders);
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: jsonLimit }));
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

app.use('/api/health', healthRoute);
app.use('/api/courses', coursesRoute);
app.use('/api/schedules', schedulesRoute);
app.use('/api/auth', authRoute);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
