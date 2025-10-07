const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();

async function resolveDb() {
  const module = await import('../database.js');
  return module.getDb();
}

const validateInput = [
  body('username').trim().isLength({ min: 3 }).escape(),
  body('password').isLength({ min: 6 })
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

router.post('/register', validateInput, handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;

  try {
    const db = await resolveDb();
    const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await db.run('INSERT INTO users (username, hashed_password) VALUES (?, ?)', [username, hashedPassword]);
    res.status(201).json({ message: '注册成功' });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/login', validateInput, handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;

  try {
    const db = await resolveDb();
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const match = await bcrypt.compare(password, user.hashed_password);
    if (match) {
      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ message: '登录成功', token });
    } else {
      res.status(401).json({ error: '用户名或密码错误' });
    }
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: '这是受保护的内容', user: req.user });
});

module.exports = router;
