const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'dennie-softs-secure-key-2025';
const ENCRYPTION_KEY = crypto.scryptSync('dennie-softs-game-encryption', 'salt', 32);
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Utility Functions
function encryptData(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptData(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function saveUsers(users) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getUserStats(username) {
  const users = loadUsers();
  if (!users[username]) return null;
  return decryptData(users[username].stats);
}

function saveUserStats(username, stats) {
  const users = loadUsers();
  if (users[username]) {
    users[username].stats = encryptData(stats);
    saveUsers(users);
  }
}

// ========================
// SIGNUP — NO ADMIN KEY
// ========================
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const users = loadUsers();

    if (users[username]) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Allow anyone to set their role (admin/user/moderator)
    const userRole = role || 'user';

    const hashedPassword = await bcrypt.hash(password, 10);

    const initialStats = {
      totalGamesPlayed: 0,
      totalWins: 0,
      totalLosses: 0,
      balance: 100,
      gamesWonToday: 0,
      lastGameTime: null,
      joinDate: new Date().toISOString(),
      role: userRole
    };

    users[username] = {
      password: hashedPassword,
      stats: encryptData(initialStats),
      createdAt: new Date().toISOString(),
      role: userRole
    };

    saveUsers(users);

    const token = jwt.sign({ username, role: userRole }, SECRET_KEY, { expiresIn: '24h' });

    res.json({ message: 'User created successfully', token, username, role: userRole, stats: initialStats });
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

// ========================
// LOGIN — NO ADMIN KEY
// ========================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const users = loadUsers();

    if (!users[username]) {
      return res.status(400).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(password, users[username].password);

    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const userRole = users[username].role || 'user';

    const token = jwt.sign({ username, role: userRole }, SECRET_KEY, { expiresIn: '24h' });
    const stats = decryptData(users[username].stats);

    res.json({ message: 'Login successful', token, username, role: userRole, stats });

  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// TOKEN CHECK
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.username = decoded.username;
    req.userRole = decoded.role || 'user';
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET STATS
app.get('/api/stats', verifyToken, (req, res) => {
  const stats = getUserStats(req.username);
  if (stats) res.json(stats);
  else res.status(400).json({ error: 'User stats not found' });
});

// GAME LOGIC
app.post('/api/play-game', verifyToken, (req, res) => {
  try {
    const { isCorrect, timeTaken } = req.body;

    if (typeof isCorrect !== 'boolean') {
      return res.status(400).json({ error: 'Invalid game result' });
    }

    const stats = getUserStats(req.username);
    if (!stats) return res.status(400).json({ error: 'User stats not found' });

    stats.totalGamesPlayed++;

    if (isCorrect) {
      let points = 100;
      if (timeTaken > 10) points = 80;
      if (timeTaken > 20) points = 60;
      if (timeTaken > 30) points = 50;
      if (timeTaken > 45) points = 40;
      if (timeTaken > 60) points = 30;

      stats.totalWins++;
      stats.gamesWonToday++;
      stats.balance += points;
    } else {
      stats.totalLosses++;
      stats.balance = Math.max(0, stats.balance - 5);
    }

    stats.lastGameTime = new Date().toISOString();
    saveUserStats(req.username, stats);

    res.json({
      message: isCorrect ? 'Correct Answer!' : 'Wrong Answer',
      isCorrect,
      newBalance: stats.balance
    });

  } catch (error) {
    res.status(500).json({ error: 'Game play failed' });
  }
});

// BUY HINT
app.post('/api/buy-hint', verifyToken, (req, res) => {
  try {
    const { hintCost } = req.body;

    if (typeof hintCost !== 'number' || hintCost < 0) {
      return res.status(400).json({ error: 'Invalid hint cost' });
    }

    const stats = getUserStats(req.username);
    if (!stats) return res.status(400).json({ error: 'User stats not found' });

    if (stats.balance < hintCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    stats.balance -= hintCost;
    saveUserStats(req.username, stats);

    res.json({ success: true, newBalance: stats.balance });

  } catch (error) {
    res.status(500).json({ error: 'Hint purchase failed' });
  }
});

// CATEGORY LIST
app.get('/api/categories', verifyToken, (req, res) => {
  res.json({
    categories: [
      { id: 'programming', name: 'Programming', icon: '💻' },
      { id: 'medicine', name: 'Medicine', icon: '⚕️' },
      { id: 'law', name: 'Law', icon: '⚖️' },
      { id: 'finance', name: 'Finance', icon: '💰' },
      { id: 'marketing', name: 'Marketing', icon: '📢' },
      { id: 'design', name: 'Design', icon: '🎨' },
      { id: 'psychology', name: 'Psychology', icon: '🧠' },
      { id: 'biology', name: 'Biology', icon: '🧬' }
    ]
  });
});

// FINAL START
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});