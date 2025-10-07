const DEFAULT_PORT = 8080;
const DEFAULT_JSON_LIMIT = '1mb';
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4173',
  'https://chuyan.vercel.app'
];

function parseOrigins(value) {
  if (!value) {
    return DEFAULT_ORIGINS;
  }

  if (value.trim() === '*') {
    return '*';
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const corsOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);
const port = Number.parseInt(process.env.PORT || DEFAULT_PORT, 10);
const jsonLimit = process.env.JSON_LIMIT || DEFAULT_JSON_LIMIT;
const mongoUri = process.env.MONGODB_URI || '';

module.exports = {
  corsOrigins,
  port: Number.isNaN(port) ? DEFAULT_PORT : port,
  jsonLimit,
  mongoUri
};
