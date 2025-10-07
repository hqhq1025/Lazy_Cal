const util = require('util');

function serializeMeta(meta) {
  if (!meta) {
    return '';
  }

  if (meta instanceof Error) {
    return `\n${meta.stack || meta.message}`;
  }

  if (typeof meta === 'string') {
    return `\n${meta}`;
  }

  try {
    return `\n${JSON.stringify(meta)}`;
  } catch (error) {
    return `\n${util.inspect(meta)}`;
  }
}

function log(level, message, meta) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}${serializeMeta(meta)}`;
  switch (level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  http: (message) => log('http', message)
};
