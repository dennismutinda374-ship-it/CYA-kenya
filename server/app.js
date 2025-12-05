const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = 'dennie-softs-secure-key-2025';
const ENCRYPTION_KEY = crypto.scryptSync('dennie-softs-game-encryption', 'salt', 32);
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CODES_FILE = path.join(DATA_DIR, 'registrationCodes.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');
const RESET_REQUESTS_FILE = path.join(DATA_DIR, 'passwordResetRequests.json');
const CODE_REQUESTS_FILE = path.join(DATA_DIR, 'codeRequests.json');
const CHAT_MESSAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const PASSWORD_RESET_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes auto-reset timeout

// Role hierarchy and permissions
const ROLES = {
  SYSTEM_ADMIN: 'system-admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  CHAIRPERSON: 'chairperson',
  VICE_CHAIR: 'vice-chair',
  SECRETARY: 'secretary',
  ORGANIZING_SECRETARY: 'organizing-secretary',
  TREASURER: 'treasurer',
  GENERAL: 'general'
};

const ROLE_PERMISSIONS = {
  [ROLES.SYSTEM_ADMIN]: ['manage_codes', 'manage_users', 'manage_game', 'view_all'],
  [ROLES.ADMIN]: ['manage_users', 'view_all'],
  [ROLES.MODERATOR]: ['manage_game', 'view_all'],
  [ROLES.CHAIRPERSON]: ['manage_events', 'manage_announcements', 'manage_tasks'],
  [ROLES.VICE_CHAIR]: ['view_events', 'view_announcements'],
  [ROLES.SECRETARY]: ['manage_announcements', 'manage_events'],
  [ROLES.ORGANIZING_SECRETARY]: ['manage_events'],
  [ROLES.TREASURER]: ['view_events'],
  [ROLES.GENERAL]: []
};

// Roles allowed to manage tasks, events, and announcements (admins and ministry roles)
const MANAGEMENT_ROLES = [ROLES.SYSTEM_ADMIN, ROLES.ADMIN, ROLES.MODERATOR, ROLES.CHAIRPERSON, ROLES.SECRETARY, ROLES.ORGANIZING_SECRETARY];

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Auto-reset job - runs on server startup and every 30 seconds
setInterval(processExpiredResetRequests, 30 * 1000);
processExpiredResetRequests();

// Auto-approve code requests job - runs every 2 minutes regardless of admin login
setInterval(autoApproveRequestsJob, 2 * 60 * 1000);
autoApproveRequestsJob();

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
  try {
    const jsonString = JSON.stringify(users, null, 2);
    fs.writeFileSync(USERS_FILE, jsonString);
  } catch (error) {
    console.error('Error saving users:', error);
    throw error;
  }
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

// Password Reset Requests Functions
function loadResetRequests() {
  if (!fs.existsSync(RESET_REQUESTS_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(RESET_REQUESTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function saveResetRequests(requests) {
  try {
    const jsonString = JSON.stringify(requests, null, 2);
    fs.writeFileSync(RESET_REQUESTS_FILE, jsonString);
  } catch (error) {
    console.error('Error saving reset requests:', error);
  }
}

// Auto-reset expired password reset requests
function processExpiredResetRequests() {
  const resetRequests = loadResetRequests();
  const now = Date.now();
  let processed = false;

  Object.entries(resetRequests).forEach(([username, request]) => {
    if (request.expiryTime && now >= request.expiryTime) {
      // Auto-generate password for expired request
      const users = loadUsers();
      if (users[username]) {
        const tempPassword = generateDefaultPassword(username);
        bcrypt.hashSync(tempPassword, 10);
        const hashedPassword = bcrypt.hashSync(tempPassword, 10);
        const newExpiryTime = Date.now() + (10 * 60 * 1000);

        users[username].password = hashedPassword;
        users[username].tempPassword = tempPassword;
        users[username].tempPasswordExpiry = newExpiryTime;
        users[username].passwordResetNeeded = false;
        delete users[username].passwordResetRequestedAt;
        saveUsers(users);

        // Update reset request
        request.autoGenerated = true;
        request.autoGeneratedAt = new Date().toISOString();
        request.tempPassword = tempPassword;
        request.expiryTime = newExpiryTime;
        processed = true;
        console.log(`Auto-generated password for user: ${username}`);
      }
    }
  });

  if (processed) {
    saveResetRequests(resetRequests);
  }
}

// Registration Codes Functions
function loadCodes() {
  if (!fs.existsSync(CODES_FILE)) {
    // Create default system admin code if not exists
    const defaultCodes = {
      'SYSADMIN2025': { role: ROLES.SYSTEM_ADMIN, used: false, createdAt: new Date().toISOString(), createdBy: 'system' }
    };
    saveCodes(defaultCodes);
    return defaultCodes;
  }
  try {
    const data = fs.readFileSync(CODES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function saveCodes(codes) {
  fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));
}

function generateCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function validateAndConsumeCode(code) {
  const codes = loadCodes();
  if (!codes[code]) {
    return { valid: false, error: 'Invalid registration code' };
  }
  if (codes[code].used && !codes[code].multiUse) {
    return { valid: false, error: 'This code has already been used' };
  }
  const role = codes[code].role;
  
  // Mark as used only if not multi-use, otherwise just track usage
  if (!codes[code].multiUse) {
    codes[code].used = true;
    codes[code].usedAt = new Date().toISOString();
  } else {
    // For multi-use codes, track count
    codes[code].usageCount = (codes[code].usageCount || 0) + 1;
    codes[code].lastUsedAt = new Date().toISOString();
  }
  
  saveCodes(codes);
  return { valid: true, role };
}

// Code Request Functions
function loadCodeRequests() {
  if (!fs.existsSync(CODE_REQUESTS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(CODE_REQUESTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function saveCodeRequests(requests) {
  fs.writeFileSync(CODE_REQUESTS_FILE, JSON.stringify(requests, null, 2));
}

// Tasks, Events, Announcements Functions
function loadTasks() {
  if (!fs.existsSync(TASKS_FILE)) return [];
  try {
    const data = fs.readFileSync(TASKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch { return []; }
}

function saveTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function loadEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  try {
    const data = fs.readFileSync(EVENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch { return []; }
}

function saveEvents(events) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

function loadAnnouncements() {
  if (!fs.existsSync(ANNOUNCEMENTS_FILE)) return [];
  try {
    const data = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch { return []; }
}

function saveAnnouncements(announcements) {
  fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(announcements, null, 2));
}

function loadPosts() {
  if (!fs.existsSync(POSTS_FILE)) return [];
  try {
    const data = fs.readFileSync(POSTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch { return []; }
}

function savePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Chat Functions with auto-delete after 7 days
function loadChatMessages() {
  if (!fs.existsSync(CHAT_FILE)) return [];
  try {
    const data = fs.readFileSync(CHAT_FILE, 'utf8');
    let messages = JSON.parse(data);
    
    // Filter out messages older than 7 days
    const now = Date.now();
    const filteredMessages = messages.filter(msg => {
      const msgTime = new Date(msg.createdAt).getTime();
      return (now - msgTime) < CHAT_MESSAGE_RETENTION_MS;
    });
    
    // If we removed any old messages, save the cleaned list
    if (filteredMessages.length !== messages.length) {
      saveChatMessages(filteredMessages);
    }
    
    return filteredMessages;
  } catch { return []; }
}

function saveChatMessages(messages) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(messages, null, 2));
}

// Extract user from token
function getUserFromToken(authHeader) {
  if (!authHeader) return { role: 'general', username: 'unknown' };
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    return { role: decoded.role, username: decoded.username };
  } catch {
    return { role: 'general', username: 'unknown' };
  }
}

// Token verification middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.username = decoded.username;
    req.userRole = decoded.role || 'general';
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Role-based access middleware
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// Permission check middleware
function hasPermission(permission) {
  return (req, res, next) => {
    const userPermissions = ROLE_PERMISSIONS[req.userRole] || [];
    if (!userPermissions.includes(permission) && req.userRole !== ROLES.SYSTEM_ADMIN) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// Landing page as default home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});

// ========================
// CODE REQUESTS
// ========================
app.post('/api/code-request', async (req, res) => {
  try {
    const { name, phone, church } = req.body;
    
    if (!name || !phone || !church) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    const requests = loadCodeRequests();
    const newRequest = {
      id: Date.now().toString(),
      name: name.trim(),
      phone: phone.trim(),
      church: church.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    requests.push(newRequest);
    saveCodeRequests(requests);
    
    res.json({ message: 'Code request submitted successfully', request: newRequest });
  } catch (error) {
    console.error('Code request error:', error);
    res.status(500).json({ error: 'Failed to submit code request' });
  }
});

// Auto-approve requests older than 3 minutes - Background job
function autoApproveRequestsJob() {
  try {
    const requests = loadCodeRequests();
    const codes = loadCodes();
    const now = new Date().getTime();
    const autoApproveTime = 3 * 60 * 1000; // 3 minutes
    let updated = false;

    requests.forEach(req => {
      if (req.status === 'pending') {
        const createdTime = new Date(req.createdAt).getTime();
        if (now - createdTime > autoApproveTime && !req.auto) {
          let newCode;
          do {
            newCode = generateCode();
          } while (codes[newCode]);
          
          codes[newCode] = {
            role: ROLES.GENERAL,
            used: false,
            createdAt: new Date().toISOString(),
            createdBy: 'system',
            requestedBy: req.phone
          };
          
          req.status = 'approved';
          req.approvedAt = new Date().toISOString();
          req.approvedBy = 'system';
          req.generatedCode = newCode;
          req.auto = true;
          req.autoApprovedAt = new Date().toISOString();
          updated = true;
          console.log(`Auto-approved code request for ${req.name} (${req.phone})`);
        }
      }
    });

    if (updated) {
      saveCodes(codes);
      saveCodeRequests(requests);
    }
  } catch (error) {
    console.error('Auto-approve job error:', error);
  }
}

app.get('/api/admin/code-requests', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const requests = loadCodeRequests();
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load code requests' });
  }
});

app.post('/api/admin/code-requests/:id/approve', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    const requests = loadCodeRequests();
    const requestIndex = requests.findIndex(r => r.id === id);
    
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const codeRequest = requests[requestIndex];
    
    // Generate a new code
    const codes = loadCodes();
    let newCode;
    do {
      newCode = generateCode();
    } while (codes[newCode]);
    
    codes[newCode] = {
      role: role || ROLES.GENERAL,
      used: false,
      createdAt: new Date().toISOString(),
      createdBy: req.username,
      requestedBy: codeRequest.email
    };
    
    saveCodes(codes);
    
    // Mark request as approved
    codeRequest.status = 'approved';
    codeRequest.approvedAt = new Date().toISOString();
    codeRequest.approvedBy = req.username;
    codeRequest.generatedCode = newCode;
    codeRequest.requestedBy = codeRequest.phone;
    requests[requestIndex] = codeRequest;
    saveCodeRequests(requests);
    
    res.json({ message: 'Code request approved', code: newCode, request: codeRequest });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve code request' });
  }
});

app.post('/api/admin/code-requests/approve-all/pending', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const requests = loadCodeRequests();
    const codes = loadCodes();
    const pendingRequests = requests.filter(r => r.status === 'pending');
    let approvedCount = 0;

    pendingRequests.forEach(codeRequest => {
      let newCode;
      do {
        newCode = generateCode();
      } while (codes[newCode]);
      
      codes[newCode] = {
        role: ROLES.GENERAL,
        used: false,
        createdAt: new Date().toISOString(),
        createdBy: req.username,
        requestedBy: codeRequest.phone
      };
      
      codeRequest.status = 'approved';
      codeRequest.approvedAt = new Date().toISOString();
      codeRequest.approvedBy = req.username;
      codeRequest.generatedCode = newCode;
      approvedCount++;
    });

    saveCodes(codes);
    saveCodeRequests(requests);
    
    res.json({ message: `Approved ${approvedCount} requests`, count: approvedCount });
  } catch (error) {
    console.error('Approve all error:', error);
    res.status(500).json({ error: 'Failed to approve all requests' });
  }
});

// Check if a code request has been approved by phone number
app.post('/api/check-approval', (req, res) => {
  try {
    const { phone, name } = req.body;
    
    if (!phone || !name) {
      return res.status(400).json({ approved: false });
    }
    
    const requests = loadCodeRequests();
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();
    const approvedRequest = requests.find(r => r.phone.trim() === trimmedPhone && r.name.trim() === trimmedName && r.status === 'approved');
    
    if (approvedRequest) {
      res.json({ approved: true, code: approvedRequest.generatedCode, church: approvedRequest.church });
    } else {
      res.json({ approved: false });
    }
  } catch (error) {
    res.json({ approved: false });
  }
});

app.delete('/api/admin/code-requests/:id', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const { id } = req.params;
    let requests = loadCodeRequests();
    requests = requests.filter(r => r.id !== id);
    saveCodeRequests(requests);
    res.json({ message: 'Request deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

// ========================
// SIGNUP with Registration Code
// ========================
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password, registrationCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (!registrationCode) {
      return res.status(400).json({ error: 'Registration code required' });
    }

    // Normalize username to lowercase for case-insensitive comparison
    const normalizedUsername = username.toLowerCase();

    // Validate registration code
    const codeResult = validateAndConsumeCode(registrationCode.toUpperCase());
    if (!codeResult.valid) {
      return res.status(400).json({ error: codeResult.error });
    }

    const users = loadUsers();

    if (users[normalizedUsername]) {
      // Revert code usage if user exists
      const codes = loadCodes();
      if (codes[registrationCode.toUpperCase()]) {
        codes[registrationCode.toUpperCase()].used = false;
        delete codes[registrationCode.toUpperCase()].usedAt;
        saveCodes(codes);
      }
      return res.status(400).json({ error: 'User already exists' });
    }

    const userRole = codeResult.role;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Get church name from code request if it exists
    let churchName = 'General Member';
    const codeRequests = loadCodeRequests();
    const approvedRequest = codeRequests.find(r => r.generatedCode === registrationCode.toUpperCase());
    if (approvedRequest) {
      churchName = approvedRequest.church;
    }

    const initialStats = {
      totalGamesPlayed: 0,
      totalWins: 0,
      totalLosses: 0,
      balance: 100,
      gamesWonToday: 0,
      lastGameTime: null,
      joinDate: new Date().toISOString(),
      role: userRole,
      church: churchName
    };

    users[normalizedUsername] = {
      password: hashedPassword,
      stats: encryptData(initialStats),
      createdAt: new Date().toISOString(),
      role: userRole,
      church: churchName,
      username: normalizedUsername
    };

    saveUsers(users);

    const token = jwt.sign({ username: normalizedUsername, role: userRole }, SECRET_KEY, { expiresIn: '24h' });

    res.json({ message: 'User created successfully', token, username: normalizedUsername, role: userRole, church: churchName, stats: initialStats });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Validate code without consuming it
app.post('/api/validate-code', async (req, res) => {
  try {
    const { registrationCode } = req.body;
    
    if (!registrationCode) {
      return res.status(400).json({ valid: false, error: 'Code required' });
    }
    
    const codes = loadCodes();
    const code = codes[registrationCode.toUpperCase()];
    
    if (!code) {
      return res.status(400).json({ valid: false, error: 'Invalid code' });
    }
    
    if (code.used) {
      return res.status(400).json({ valid: false, error: 'Code already used' });
    }
    
    res.json({ valid: true, role: code.role });
  } catch (error) {
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
});

// ========================
// LOGIN
// ========================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Normalize username to lowercase for case-insensitive login
    const normalizedUsername = username.toLowerCase();
    const users = loadUsers();

    if (!users[normalizedUsername]) {
      return res.status(400).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(password, users[normalizedUsername].password);

    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const userRole = users[normalizedUsername].role || 'general';
    const token = jwt.sign({ username: normalizedUsername, role: userRole }, SECRET_KEY, { expiresIn: '24h' });
    const stats = decryptData(users[normalizedUsername].stats);

    res.json({ message: 'Login successful', token, username: normalizedUsername, role: userRole, stats });

  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET STATS
app.get('/api/stats', verifyToken, (req, res) => {
  const stats = getUserStats(req.username);
  if (stats) res.json(stats);
  else res.status(400).json({ error: 'User stats not found' });
});

// ========================
// PROFILE MANAGEMENT
// ========================
app.put('/api/profile/username', verifyToken, async (req, res) => {
  try {
    const { newUsername, password } = req.body;
    
    if (!newUsername || !password) {
      return res.status(400).json({ error: 'New username and password required' });
    }

    if (newUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    const normalizedNewUsername = newUsername.toLowerCase();
    const normalizedCurrentUsername = req.username.toLowerCase();
    const users = loadUsers();

    // Check if user exists
    if (!users[normalizedCurrentUsername]) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, users[normalizedCurrentUsername].password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check if new username is already taken
    if (normalizedNewUsername !== normalizedCurrentUsername && users[normalizedNewUsername]) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // If username is different, update the key
    if (normalizedNewUsername !== normalizedCurrentUsername) {
      const userData = users[normalizedCurrentUsername];
      delete users[normalizedCurrentUsername];
      users[normalizedNewUsername] = { ...userData };
      users[normalizedNewUsername].updatedAt = new Date().toISOString();
      saveUsers(users);
    }

    res.json({ message: 'Username updated successfully', username: normalizedNewUsername });
  } catch (error) {
    console.error('Profile username update error:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

app.put('/api/profile/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const normalizedUsername = req.username.toLowerCase();
    const users = loadUsers();

    // Check if user exists
    if (!users[normalizedUsername]) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, users[normalizedUsername].password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    users[normalizedUsername].password = hashedPassword;
    users[normalizedUsername].updatedAt = new Date().toISOString();
    saveUsers(users);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Profile password update error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// ========================
// ADMIN: Registration Code Management (System Admin Only)
// ========================
app.get('/api/admin/codes', verifyToken, requireRole(ROLES.SYSTEM_ADMIN), (req, res) => {
  try {
    const codes = loadCodes();
    const codeList = Object.entries(codes).map(([code, data]) => ({
      code,
      ...data
    }));
    res.json({ codes: codeList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load codes' });
  }
});

app.post('/api/admin/codes', verifyToken, requireRole(ROLES.SYSTEM_ADMIN), (req, res) => {
  try {
    const { role, quantity = 1, multiUse = false } = req.body;
    
    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    
    // Multi-use codes are only allowed for general members
    if (multiUse && role !== ROLES.GENERAL) {
      return res.status(400).json({ error: 'Multi-use codes can only be generated for General Members' });
    }
    
    const codes = loadCodes();
    const newCodes = [];
    
    for (let i = 0; i < quantity; i++) {
      let newCode;
      do {
        newCode = generateCode();
      } while (codes[newCode]);
      
      codes[newCode] = {
        role,
        used: false,
        multiUse: multiUse || false,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        createdBy: req.username
      };
      newCodes.push({ code: newCode, role, multiUse: multiUse || false });
    }
    
    saveCodes(codes);
    res.json({ message: `Created ${quantity} code(s) ${multiUse ? '(Multi-use)' : ''}`, codes: newCodes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create codes' });
  }
});

app.delete('/api/admin/codes/:code', verifyToken, requireRole(ROLES.SYSTEM_ADMIN), (req, res) => {
  try {
    const codes = loadCodes();
    const codeToDelete = req.params.code.toUpperCase();
    
    if (!codes[codeToDelete]) {
      return res.status(404).json({ error: 'Code not found' });
    }
    
    delete codes[codeToDelete];
    saveCodes(codes);
    res.json({ message: 'Code deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete code' });
  }
});

// ========================
// ADMIN: User Management (Admin + System Admin)
// ========================
app.get('/api/admin/users', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const users = loadUsers();
    const userList = Object.entries(users).map(([username, user]) => {
      const stats = decryptData(user.stats);
      return {
        username,
        role: user.role,
        balance: stats.balance || 0,
        wins: stats.totalWins || 0,
        losses: stats.totalLosses || 0,
        gamesPlayed: stats.totalGamesPlayed || 0,
        createdAt: user.createdAt
      };
    });
    res.json({ users: userList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

app.post('/api/admin/users/:username/reset', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const { username } = req.params;
    const users = loadUsers();
    
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const currentStats = decryptData(users[username].stats);
    const resetStats = {
      totalGamesPlayed: 0,
      totalWins: 0,
      totalLosses: 0,
      balance: 100,
      gamesWonToday: 0,
      lastGameTime: null,
      joinDate: currentStats.joinDate,
      role: users[username].role
    };
    
    users[username].stats = encryptData(resetStats);
    saveUsers(users);
    
    res.json({ message: `Stats reset for ${username}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset stats' });
  }
});

app.post('/api/admin/users/:username/balance', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const { username } = req.params;
    const { amount, operation } = req.body;
    
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const users = loadUsers();
    
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const stats = decryptData(users[username].stats);
    
    if (operation === 'add') {
      stats.balance += amount;
    } else if (operation === 'deduct') {
      stats.balance = Math.max(0, stats.balance - amount);
    } else {
      return res.status(400).json({ error: 'Invalid operation. Use "add" or "deduct"' });
    }
    
    users[username].stats = encryptData(stats);
    saveUsers(users);
    
    res.json({ message: `Balance updated for ${username}`, newBalance: stats.balance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

app.post('/api/admin/users/:username/role', verifyToken, requireRole(ROLES.SYSTEM_ADMIN), (req, res) => {
  try {
    const { username } = req.params;
    const { role } = req.body;
    
    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const users = loadUsers();
    
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    users[username].role = role;
    const stats = decryptData(users[username].stats);
    stats.role = role;
    users[username].stats = encryptData(stats);
    saveUsers(users);
    
    res.json({ message: `Role updated for ${username}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

app.delete('/api/admin/users/:username', verifyToken, requireRole(ROLES.SYSTEM_ADMIN), (req, res) => {
  try {
    const { username } = req.params;
    const users = loadUsers();
    
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (username === req.username) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    delete users[username];
    saveUsers(users);
    
    res.json({ message: `User ${username} deleted` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ========================
// MODERATOR: Game Management (Moderator + System Admin)
// ========================
// Questions database (in-memory, can be extended to file storage)
let questions = {
  oldTestament: [
    { questionId: 'ot1', question: 'Who was the first man according to the Bible?', options: ['Noah', 'Abraham', 'Adam', 'Moses'], correctIndex: 2, hints: [{ text: 'He was created in God\'s image', cost: 10 }] },
    { questionId: 'ot2', question: 'How many commandments did God give to Moses?', options: ['5', '8', '10', '12'], correctIndex: 2, hints: [{ text: 'They are written on stone tablets', cost: 10 }] },
    { questionId: 'ot3', question: 'Who built the ark to save his family from the flood?', options: ['Abraham', 'Moses', 'Noah', 'Jacob'], correctIndex: 2, hints: [{ text: 'He had sons named Shem, Ham, and Japheth', cost: 10 }] },
    { questionId: 'ot4', question: 'How many plagues did God send to Egypt?', options: ['7', '9', '10', '12'], correctIndex: 2, hints: [{ text: 'Include frogs, locusts, and hail', cost: 10 }] },
    { questionId: 'ot5', question: 'Who defeated Goliath with a slingshot?', options: ['Samson', 'Joshua', 'David', 'Jonathan'], correctIndex: 2, hints: [{ text: 'He later became King of Israel', cost: 10 }] }
  ],
  newTestament: [
    { questionId: 'nt1', question: 'How many gospels are in the New Testament?', options: ['2', '3', '4', '5'], correctIndex: 2, hints: [{ text: 'Matthew, Mark, Luke, and...', cost: 10 }] },
    { questionId: 'nt2', question: 'What is the shortest book in the Bible?', options: ['1 John', '2 John', '3 John', 'Philemon'], correctIndex: 2, hints: [{ text: 'It is only 25 verses long', cost: 10 }] },
    { questionId: 'nt3', question: 'How many letters did Paul write that are in the New Testament?', options: ['11', '13', '14', '16'], correctIndex: 1, hints: [{ text: 'Include Romans and Corinthians', cost: 10 }] },
    { questionId: 'nt4', question: 'What city did Jesus perform His first miracle in?', options: ['Jerusalem', 'Bethlehem', 'Cana', 'Nazareth'], correctIndex: 2, hints: [{ text: 'He turned water into wine there', cost: 10 }] },
    { questionId: 'nt5', question: 'How many times did Jesus rise from the dead?', options: ['Never', 'Once', 'Twice', 'Multiple times'], correctIndex: 1, hints: [{ text: 'He came back on the third day', cost: 10 }] }
  ],
  jesus: [
    { questionId: 'js1', question: 'In which town was Jesus born?', options: ['Jerusalem', 'Nazareth', 'Bethlehem', 'Jericho'], correctIndex: 2, hints: [{ text: 'The City of David', cost: 10 }] },
    { questionId: 'js2', question: 'What was Jesus\'s earthly father\'s occupation?', options: ['Fisherman', 'Carpenter', 'Shepherd', 'Pharisee'], correctIndex: 1, hints: [{ text: 'He worked with wood', cost: 10 }] },
    { questionId: 'js3', question: 'How many disciples did Jesus choose?', options: ['7', '10', '12', '14'], correctIndex: 2, hints: [{ text: 'One of them betrayed Him', cost: 10 }] },
    { questionId: 'js4', question: 'What did Jesus teach using parables?', options: ['Only about money', 'Spiritual truths', 'Only about farming', 'His genealogy'], correctIndex: 1, hints: [{ text: 'Stories with moral lessons', cost: 10 }] },
    { questionId: 'js5', question: 'Who denied knowing Jesus three times?', options: ['James', 'John', 'Peter', 'Andrew'], correctIndex: 2, hints: [{ text: 'He was a leading apostle', cost: 10 }] }
  ],
  apostles: [
    { questionId: 'ap1', question: 'Which apostle was a tax collector before following Jesus?', options: ['Peter', 'Matthew', 'John', 'Andrew'], correctIndex: 1, hints: [{ text: 'Also known as Levi', cost: 10 }] },
    { questionId: 'ap2', question: 'Who was the first martyr of the early church?', options: ['Peter', 'Paul', 'Stephen', 'James'], correctIndex: 2, hints: [{ text: 'He was stoned to death', cost: 10 }] },
    { questionId: 'ap3', question: 'On which day did the Holy Spirit come to the apostles?', options: ['Easter', 'Pentecost', 'Ascension', 'Passover'], correctIndex: 1, hints: [{ text: 'Also called the Day of Pentecost', cost: 10 }] },
    { questionId: 'ap4', question: 'How many converts did Peter baptize on Pentecost?', options: ['120', '500', '3,000', '5,000'], correctIndex: 2, hints: [{ text: 'It was in the thousands', cost: 10 }] },
    { questionId: 'ap5', question: 'Who traveled extensively on missionary journeys spreading the Gospel?', options: ['John', 'Peter', 'Paul', 'Thomas'], correctIndex: 2, hints: [{ text: 'He was previously called Saul', cost: 10 }] }
  ],
  kings: [
    { questionId: 'kg1', question: 'Who was the first king of Israel?', options: ['David', 'Saul', 'Solomon', 'Rehoboam'], correctIndex: 1, hints: [{ text: 'He was chosen by the prophet Samuel', cost: 10 }] },
    { questionId: 'kg2', question: 'How many wives did King Solomon have?', options: ['7', '100', '700', '1000'], correctIndex: 2, hints: [{ text: 'It was a very large number', cost: 10 }] },
    { questionId: 'kg3', question: 'Who built the first Temple in Jerusalem?', options: ['David', 'Solomon', 'Hezekiah', 'Josiah'], correctIndex: 1, hints: [{ text: 'His father gathered the materials', cost: 10 }] },
    { questionId: 'kg4', question: 'How long did King David reign in Israel?', options: ['20 years', '30 years', '40 years', '50 years'], correctIndex: 2, hints: [{ text: 'It was a round number of decades', cost: 10 }] },
    { questionId: 'kg5', question: 'Which king of Israel was known for his wisdom?', options: ['Saul', 'David', 'Solomon', 'Asa'], correctIndex: 2, hints: [{ text: 'God gave him extraordinary wisdom', cost: 10 }] }
  ],
  prophets: [
    { questionId: 'pr1', question: 'Who prophesied about Jesus being born in Bethlehem?', options: ['Isaiah', 'Jeremiah', 'Micah', 'Amos'], correctIndex: 2, hints: [{ text: 'He was a minor prophet', cost: 10 }] },
    { questionId: 'pr2', question: 'Which prophet was taken to heaven without dying?', options: ['Elijah', 'Elisha', 'Enoch', 'Moses'], correctIndex: 0, hints: [{ text: 'He went up in a whirlwind', cost: 10 }] },
    { questionId: 'pr3', question: 'Who was swallowed by a great fish?', options: ['Isaiah', 'Jonah', 'Jeremiah', 'Zechariah'], correctIndex: 1, hints: [{ text: 'He preached to Nineveh', cost: 10 }] },
    { questionId: 'pr4', question: 'How many books did Isaiah write in the Old Testament?', options: ['1', '2', '3', '4'], correctIndex: 0, hints: [{ text: 'It is one long book', cost: 10 }] },
    { questionId: 'pr5', question: 'Who was the prophet in the wilderness baptizing people?', options: ['Philip', 'John the Baptist', 'Peter', 'Andrew'], correctIndex: 1, hints: [{ text: 'He baptized Jesus in the Jordan', cost: 10 }] }
  ],
  parables: [
    { questionId: 'pb1', question: 'In the parable of the sower, what do the seeds represent?', options: ['Money', 'The Word of God', 'Earthly possessions', 'Eternal life'], correctIndex: 1, hints: [{ text: 'About spreading God\'s message', cost: 10 }] },
    { questionId: 'pb2', question: 'What is the main lesson of the Good Samaritan parable?', options: ['Avoid strangers', 'Love your neighbors', 'Help only your friends', 'Give to the poor'], correctIndex: 1, hints: [{ text: 'About compassion and kindness', cost: 10 }] },
    { questionId: 'pb3', question: 'In the parable of the prodigal son, what does the father represent?', options: ['Judgment', 'God\'s love and forgiveness', 'Punishment', 'Earthly wealth'], correctIndex: 1, hints: [{ text: 'About forgiveness', cost: 10 }] },
    { questionId: 'pb4', question: 'What does the mustard seed parable teach?', options: ['How to farm', 'Small faith grows into something great', 'Importance of farming', 'Humility only'], correctIndex: 1, hints: [{ text: 'About the kingdom of God', cost: 10 }] },
    { questionId: 'pb5', question: 'In the parable of the talents, what do the talents represent?', options: ['Coins', 'Spiritual gifts and abilities', 'Hard work', 'Material wealth'], correctIndex: 1, hints: [{ text: 'About using what God has given you', cost: 10 }] }
  ],
  miracles: [
    { questionId: 'mr1', question: 'Which miracle did Jesus perform first according to John\'s Gospel?', options: ['Healing the blind man', 'Turning water to wine', 'Feeding the 5,000', 'Walking on water'], correctIndex: 1, hints: [{ text: 'It was at a wedding in Cana', cost: 10 }] },
    { questionId: 'mr2', question: 'How many loaves and fish did Jesus use to feed the 5,000?', options: ['2 loaves and 2 fish', '5 loaves and 2 fish', '7 loaves and 5 fish', '10 loaves and 3 fish'], correctIndex: 1, hints: [{ text: 'It was a small meal', cost: 10 }] },
    { questionId: 'mr3', question: 'Which body of water did Jesus calm by saying "Peace, be still"?', options: ['Red Sea', 'Dead Sea', 'Sea of Galilee', 'Mediterranean Sea'], correctIndex: 2, hints: [{ text: 'Also called the Sea of Tiberias', cost: 10 }] },
    { questionId: 'mr4', question: 'How many days was Jesus in the tomb before resurrection?', options: ['1', '2', '3', '4'], correctIndex: 2, hints: [{ text: 'He rose on the third day', cost: 10 }] },
    { questionId: 'mr5', question: 'Which person did Jesus raise from the dead?', options: ['His sister Mary', 'Lazarus', 'His mother', 'Peter\'s wife'], correctIndex: 1, hints: [{ text: 'He had been dead for four days', cost: 10 }] }
  ]
};

app.get('/api/admin/questions', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.MODERATOR), (req, res) => {
  res.json({ questions });
});

app.post('/api/admin/questions', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.MODERATOR), (req, res) => {
  try {
    const { category, question, options, correctIndex, hints } = req.body;
    
    if (!category || !question || !options || correctIndex === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!questions[category]) {
      questions[category] = [];
    }
    
    const newQuestion = {
      questionId: `${category}_${Date.now()}`,
      question,
      options,
      correctIndex,
      hints: hints || []
    };
    
    questions[category].push(newQuestion);
    res.json({ message: 'Question added', question: newQuestion });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add question' });
  }
});

app.delete('/api/admin/questions/:category/:questionId', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.MODERATOR), (req, res) => {
  try {
    const { category, questionId } = req.params;
    
    if (!questions[category]) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const index = questions[category].findIndex(q => q.questionId === questionId);
    if (index === -1) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    questions[category].splice(index, 1);
    res.json({ message: 'Question deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// ========================
// GAME LOGIC
// ========================
app.post('/api/play-game', verifyToken, (req, res) => {
  try {
    const { isCorrect, timeTaken } = req.body;

    if (typeof isCorrect !== 'boolean') {
      return res.status(400).json({ error: 'Invalid game result' });
    }

    const stats = getUserStats(req.username);
    if (!stats) return res.status(400).json({ error: 'User stats not found' });

    stats.totalGamesPlayed++;
    let pointsEarned = 0;

    if (isCorrect) {
      let points = 100;
      if (timeTaken > 10) points = 80;
      if (timeTaken > 20) points = 60;
      if (timeTaken > 30) points = 50;
      if (timeTaken > 45) points = 40;
      if (timeTaken > 60) points = 30;

      pointsEarned = points;
      stats.totalWins++;
      stats.gamesWonToday++;
      stats.balance += points;
    } else {
      pointsEarned = -5;
      stats.totalLosses++;
      stats.balance = Math.max(0, stats.balance - 5);
    }

    stats.lastGameTime = new Date().toISOString();
    saveUserStats(req.username, stats);

    res.json({
      message: isCorrect ? 'Correct Answer!' : 'Wrong Answer',
      isCorrect,
      pointsEarned,
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
      { id: 'oldTestament', name: 'Old Testament', icon: '📖' },
      { id: 'newTestament', name: 'New Testament', icon: '📕' },
      { id: 'jesus', name: 'Jesus & Gospels', icon: '✝️' },
      { id: 'apostles', name: 'Apostles & Early Church', icon: '⛪' },
      { id: 'kings', name: 'Kings & Rulers', icon: '👑' },
      { id: 'prophets', name: 'Prophets', icon: '🕯️' },
      { id: 'parables', name: 'Parables', icon: '📚' },
      { id: 'miracles', name: 'Miracles', icon: '✨' }
    ]
  });
});

// GET QUESTION
app.get('/api/get-question', verifyToken, (req, res) => {
  try {
    const category = req.query.category;
    
    if (!category || !questions[category]) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const categoryQuestions = questions[category];
    const randomQuestion = categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];
    
    res.json(randomQuestion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get question' });
  }
});

// ========================
// TASKS
// ========================
app.get('/api/tasks', verifyToken, (req, res) => {
  try {
    res.json(loadTasks());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

app.post('/api/tasks', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const canManageTasks = MANAGEMENT_ROLES.includes(user.role);
    
    if (!canManageTasks) {
      return res.status(403).json({ error: 'Only administrators and ministry leaders can manage tasks' });
    }
    
    const { id, title, assignee, priority, status } = req.body;
    const tasks = loadTasks();
    const index = tasks.findIndex(t => t.id === id);
    
    if (index >= 0) {
      tasks[index] = { ...tasks[index], title, assignee, priority, status };
    } else {
      tasks.push({ id: Date.now().toString(), title, assignee, priority, status });
    }
    
    saveTasks(tasks);
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save task' });
  }
});

app.delete('/api/tasks/:id', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const canManageTasks = MANAGEMENT_ROLES.includes(user.role);
    
    if (!canManageTasks) {
      return res.status(403).json({ error: 'Only administrators and ministry leaders can delete tasks' });
    }
    
    const tasks = loadTasks().filter(t => t.id !== req.params.id);
    saveTasks(tasks);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ========================
// EVENTS - Admins and ministry leaders can modify
// ========================
app.get('/api/events', verifyToken, (req, res) => {
  try {
    res.json(loadEvents());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load events' });
  }
});

app.post('/api/events', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const canManageEvents = MANAGEMENT_ROLES.includes(user.role);
    
    if (!canManageEvents) {
      return res.status(403).json({ error: 'Only administrators and ministry leaders can manage activities' });
    }
    
    const { id, title, date, description } = req.body;
    const events = loadEvents();
    const index = events.findIndex(e => e.id === id);
    
    if (index >= 0) {
      events[index] = { ...events[index], title, date, description };
    } else {
      events.push({ id: Date.now().toString(), title, date, description, createdBy: user.username });
    }
    
    saveEvents(events);
    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save event' });
  }
});

app.delete('/api/events/:id', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const canManageEvents = MANAGEMENT_ROLES.includes(user.role);
    
    if (!canManageEvents) {
      return res.status(403).json({ error: 'Only administrators and ministry leaders can delete activities' });
    }
    
    const events = loadEvents().filter(e => e.id !== req.params.id);
    saveEvents(events);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ========================
// ANNOUNCEMENTS - Admins and ministry leaders can modify
// ========================
app.get('/api/announcements', verifyToken, (req, res) => {
  try {
    res.json(loadAnnouncements());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load announcements' });
  }
});

app.post('/api/announcements', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const canManageAnnouncements = MANAGEMENT_ROLES.includes(user.role);
    
    if (!canManageAnnouncements) {
      return res.status(403).json({ error: 'Only administrators and ministry leaders can manage announcements' });
    }
    
    const { id, title, content, date } = req.body;
    const announcements = loadAnnouncements();
    const index = announcements.findIndex(a => a.id === id);
    
    if (index >= 0) {
      announcements[index] = { ...announcements[index], title, content, date };
    } else {
      announcements.push({ id: Date.now().toString(), title, content, date, createdBy: user.username });
    }
    
    saveAnnouncements(announcements);
    res.json({ success: true, announcements });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save announcement' });
  }
});

app.delete('/api/announcements/:id', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const canManageAnnouncements = MANAGEMENT_ROLES.includes(user.role);
    
    if (!canManageAnnouncements) {
      return res.status(403).json({ error: 'Only administrators and ministry leaders can delete announcements' });
    }
    
    const announcements = loadAnnouncements().filter(a => a.id !== req.params.id);
    saveAnnouncements(announcements);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// ========================
// POSTS - All users can create, anyone can view
// ========================
app.get('/api/posts', verifyToken, (req, res) => {
  try {
    res.json(loadPosts());
  } catch (error) {
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

app.post('/api/posts', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }
    
    const posts = loadPosts();
    posts.push({
      id: Date.now().toString(),
      author: user.username,
      role: user.role,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      loves: 0
    });
    
    savePosts(posts);
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.delete('/api/posts/:id', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const posts = loadPosts();
    const post = posts.find(p => p.id === req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (post.author !== user.username && !['system-admin', 'admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }
    
    const filtered = posts.filter(p => p.id !== req.params.id);
    savePosts(filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Like/Love posts
app.post('/api/posts/:id/like', verifyToken, (req, res) => {
  try {
    const user = getUserFromToken(req.headers.authorization);
    const { type } = req.body; // 'like' or 'love'
    const posts = loadPosts();
    const post = posts.find(p => p.id === req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (!post.likedBy) post.likedBy = [];
    if (!post.lovedBy) post.lovedBy = [];
    
    const likeKey = `${user.username}:${type}`;
    const existingIndex = post.likedBy.findIndex(l => l === `${user.username}:like`);
    const existingLoveIndex = post.lovedBy.findIndex(l => l === `${user.username}:love`);
    
    if (type === 'like') {
      if (existingIndex >= 0) {
        post.likedBy.splice(existingIndex, 1);
      } else {
        post.likedBy.push(`${user.username}:like`);
        if (existingLoveIndex >= 0) post.lovedBy.splice(existingLoveIndex, 1);
      }
    } else if (type === 'love') {
      if (existingLoveIndex >= 0) {
        post.lovedBy.splice(existingLoveIndex, 1);
      } else {
        post.lovedBy.push(`${user.username}:love`);
        if (existingIndex >= 0) post.likedBy.splice(existingIndex, 1);
      }
    }
    
    post.likes = post.likedBy.length;
    post.loves = post.lovedBy.length;
    
    savePosts(posts);
    res.json({ success: true, likes: post.likes, loves: post.loves });
  } catch (error) {
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// ========================
// LEADERBOARD with Win Rate (Grouped by Church, excludes system admins)
// ========================
app.get('/api/leaderboard', (req, res) => {
  try {
    const sortBy = req.query.sortBy || 'wins';
    const limit = parseInt(req.query.limit) || 100;
    
    const users = loadUsers();
    const codeRequests = loadCodeRequests();
    const leaderboard = [];
    
    Object.entries(users).forEach(([username, user]) => {
      // Exclude system admins from leaderboard
      if (user.role === 'system-admin') {
        return;
      }
      
      const stats = decryptData(user.stats);
      const games = stats.totalGamesPlayed || 0;
      const wins = stats.totalWins || 0;
      const winRate = games > 0 ? ((wins / games) * 100).toFixed(1) : 0;
      
      // Calculate game score stats
      const totalGameScore = stats.totalGameScore || 0;
      const gamesPlayedTotal = stats.gamesPlayedTotal || 0;
      const avgGameScore = gamesPlayedTotal > 0 ? (totalGameScore / gamesPlayedTotal).toFixed(1) : 0;
      
      // Get church name - use stored church or default to AIC Kitanga
      const churchName = user.church || 'AIC Kitanga';
      
      leaderboard.push({
        username: username,
        church: churchName,
        wins: wins,
        losses: stats.totalLosses || 0,
        games: games,
        balance: stats.balance || 0,
        winRate: parseFloat(winRate),
        totalGameScore: totalGameScore,
        gamesPlayedTotal: gamesPlayedTotal,
        avgGameScore: parseFloat(avgGameScore),
        joinDate: user.createdAt || new Date().toISOString(),
        rank: 0
      });
    });

    // Group by church
    const groupedByChurch = {};
    leaderboard.forEach(player => {
      if (!groupedByChurch[player.church]) {
        groupedByChurch[player.church] = [];
      }
      groupedByChurch[player.church].push(player);
    });

    // Sort within each church group and flatten
    const sortedLeaderboard = [];
    Object.keys(groupedByChurch).sort().forEach(church => {
      const churchPlayers = groupedByChurch[church];
      
      // Sort by specified criteria
      if (sortBy === 'wins') {
        churchPlayers.sort((a, b) => b.wins - a.wins);
      } else if (sortBy === 'balance') {
        churchPlayers.sort((a, b) => b.balance - a.balance);
      } else if (sortBy === 'games') {
        churchPlayers.sort((a, b) => b.gamesPlayedTotal - a.gamesPlayedTotal);
      } else if (sortBy === 'winRate') {
        churchPlayers.sort((a, b) => b.winRate - a.winRate);
      } else if (sortBy === 'gameScore') {
        churchPlayers.sort((a, b) => b.totalGameScore - a.totalGameScore);
      }
      
      // Add church header
      sortedLeaderboard.push({
        isChurchHeader: true,
        church: church,
        playerCount: churchPlayers.length
      });
      
      // Add ranked players with church-specific ranks
      churchPlayers.forEach((player, index) => {
        player.rank = index + 1;
        player.churchRank = index + 1;
        sortedLeaderboard.push(player);
      });
    });

    // Limit results
    const limited = sortedLeaderboard.slice(0, limit);
    res.json({ leaderboard: limited });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ========================
// ONLINE MEMBERS (for dashboard)
// ========================
app.get('/api/online-members', verifyToken, (req, res) => {
  try {
    const users = loadUsers();
    const members = Object.entries(users).map(([username, user]) => ({
      name: username,
      role: user.role,
      online: Math.random() > 0.5 // Simulated online status
    })).slice(0, 10);
    
    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load members' });
  }
});

// Get user role info
app.get('/api/user-info', verifyToken, (req, res) => {
  try {
    const users = loadUsers();
    const user = users[req.username];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      username: req.username,
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role] || []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ========================
// FORGOT PASSWORD & RESET (Admin)
// ========================

// Helper function to generate default password
function generateDefaultPassword(username) {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${username}@${randomNum}`;
}

app.post('/api/forgot-password', (req, res) => {
  try {
    const { username } = req.body;
    const users = loadUsers();
    
    if (!users[username]) {
      return res.status(404).json({ message: 'Username not found' });
    }
    
    // Mark user as needing password reset
    users[username].passwordResetNeeded = true;
    users[username].passwordResetRequestedAt = new Date().toISOString();
    saveUsers(users);

    // Create persistent reset request with auto-expiry
    const resetRequests = loadResetRequests();
    resetRequests[username] = {
      username,
      requestedAt: new Date().toISOString(),
      expiryTime: Date.now() + PASSWORD_RESET_TIMEOUT_MS, // 5 minutes
      autoGenerated: false
    };
    saveResetRequests(resetRequests);
    
    res.json({ message: 'Password reset request sent to admin. Will auto-reset in 5 minutes if no action taken.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Get users needing password reset WITH countdown timers (Admin only)
app.get('/api/admin/password-resets', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const users = loadUsers();
    const resetRequests = loadResetRequests();
    const now = Date.now();

    const resetNeeded = Object.entries(users)
      .filter(([_, user]) => user.passwordResetNeeded === true)
      .map(([username, user]) => {
        const request = resetRequests[username];
        const timeRemaining = request && request.expiryTime ? Math.max(0, request.expiryTime - now) : PASSWORD_RESET_TIMEOUT_MS;
        const secondsRemaining = Math.ceil(timeRemaining / 1000);

        return {
          username,
          role: user.role,
          requestedAt: user.passwordResetRequestedAt,
          expiryTime: request?.expiryTime || (now + PASSWORD_RESET_TIMEOUT_MS),
          timeRemainingMs: timeRemaining,
          secondsRemaining,
          autoGenerated: request?.autoGenerated || false
        };
      });
    
    res.json({ users: resetNeeded });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load reset requests' });
  }
});

// Auto-reset user password (Admin only) - generates default password
app.post('/api/admin/users/:username/auto-reset', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const { username } = req.params;
    const users = loadUsers();
    
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate default password
    const tempPassword = generateDefaultPassword(username);
    
    // Hash the password
    bcrypt.hash(tempPassword, 10, (err, hashedPassword) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to hash password' });
      }
      
      // Set temp password with 10-minute expiry (600 seconds)
      const expiryTime = Date.now() + (10 * 60 * 1000);
      
      users[username].password = hashedPassword;
      users[username].tempPassword = tempPassword;
      users[username].tempPasswordExpiry = expiryTime;
      users[username].passwordResetNeeded = false;
      delete users[username].passwordResetRequestedAt;
      saveUsers(users);

      // Update reset request record
      const resetRequests = loadResetRequests();
      if (resetRequests[username]) {
        resetRequests[username].autoGenerated = true;
        resetRequests[username].autoGeneratedAt = new Date().toISOString();
        resetRequests[username].tempPassword = tempPassword;
        saveResetRequests(resetRequests);
      }
      
      res.json({ 
        message: `Password auto-generated for ${username}`,
        tempPassword,
        expiryTime
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get temporary password for user (after admin reset)
app.post('/api/get-temp-password', (req, res) => {
  try {
    const { username } = req.body;
    const users = loadUsers();
    
    if (!users[username]) {
      return res.status(404).json({ message: 'Username not found' });
    }
    
    const user = users[username];
    
    // Check if temp password exists and hasn't expired
    if (!user.tempPassword || !user.tempPasswordExpiry) {
      return res.status(404).json({ message: 'No temporary password available. Please contact admin.' });
    }
    
    if (Date.now() > user.tempPasswordExpiry) {
      // Password expired, clean up
      delete user.tempPassword;
      delete user.tempPasswordExpiry;
      saveUsers(users);
      return res.status(410).json({ message: 'Temporary password expired. Please request a new reset.' });
    }
    
    const remainingTime = user.tempPasswordExpiry - Date.now();
    res.json({ 
      tempPassword: user.tempPassword,
      expiryTime: user.tempPasswordExpiry,
      remainingSeconds: Math.floor(remainingTime / 1000)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve password' });
  }
});

// Reset user password (Admin only) - manual password
app.post('/api/admin/users/:username/password-reset', verifyToken, requireRole(ROLES.SYSTEM_ADMIN, ROLES.ADMIN), (req, res) => {
  try {
    const { username } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const users = loadUsers();
    
    if (!users[username]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to hash password' });
      }
      
      users[username].password = hashedPassword;
      users[username].passwordResetNeeded = false;
      delete users[username].passwordResetRequestedAt;
      saveUsers(users);
      
      res.json({ message: `Password reset for ${username}` });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ========================
// GAME SCORE TRACKING
// ========================

// Save game score and update user stats
app.post('/api/save-game-score', verifyToken, (req, res) => {
  try {
    const { gameType, difficulty, score, maxScore, percentage } = req.body;
    
    if (!gameType || !difficulty || score === undefined || !maxScore) {
      return res.status(400).json({ error: 'Invalid game score data' });
    }
    
    const users = loadUsers();
    const user = users[req.username];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let stats = decryptData(user.stats);
    
    // Initialize game stats if not present
    if (!stats.gameStats) {
      stats.gameStats = {};
    }
    if (!stats.gameStats[gameType]) {
      stats.gameStats[gameType] = {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        difficultyStats: { easy: { played: 0, score: 0 }, medium: { played: 0, score: 0 }, hard: { played: 0, score: 0 } }
      };
    }
    
    const gameStats = stats.gameStats[gameType];
    gameStats.gamesPlayed++;
    gameStats.totalScore += score;
    gameStats.bestScore = Math.max(gameStats.bestScore, score);
    gameStats.difficultyStats[difficulty].played++;
    gameStats.difficultyStats[difficulty].score += score;
    
    // Update overall stats
    stats.totalGameScore = (stats.totalGameScore || 0) + score;
    stats.gamesPlayedTotal = (stats.gamesPlayedTotal || 0) + 1;
    
    user.stats = encryptData(stats);
    saveUsers(users);
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Game score save error:', error);
    res.status(500).json({ error: 'Failed to save game score' });
  }
});

// ========================
// CHAT API ENDPOINTS
// ========================

// Track typing users
let typingUsers = {};
const TYPING_TIMEOUT = 3500;

// Get all chat messages
app.get('/api/chat', verifyToken, (req, res) => {
  try {
    const messages = loadChatMessages();
    res.json({ messages });
  } catch (error) {
    console.error('Chat load error:', error);
    res.status(500).json({ error: 'Failed to load chat messages' });
  }
});

// Send a new chat message
app.post('/api/chat', verifyToken, (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    const messages = loadChatMessages();
    const users = loadUsers();
    const user = users[req.username];
    
    const newMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      username: req.username,
      role: user ? user.role : 'general',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      reactions: {}
    };
    
    messages.push(newMessage);
    saveChatMessages(messages);
    
    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Chat send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Clear all chat messages (non-general users only) - MUST be before /:id route
app.delete('/api/chat/clear', verifyToken, (req, res) => {
  try {
    // Only non-general users can clear messages
    if (req.userRole === 'general') {
      return res.status(403).json({ error: 'Not authorized to clear messages' });
    }
    
    // Clear all messages
    saveChatMessages([]);
    
    res.json({ success: true, message: 'All messages cleared' });
  } catch (error) {
    console.error('Chat clear error:', error);
    res.status(500).json({ error: 'Failed to clear messages' });
  }
});

// Delete a chat message (own messages or admin)
app.delete('/api/chat/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    let messages = loadChatMessages();
    
    const messageIndex = messages.findIndex(m => m.id === id);
    
    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const message = messages[messageIndex];
    
    // Allow deletion if user owns the message or is an admin
    const adminRoles = ['system-admin', 'admin', 'moderator'];
    if (message.username !== req.username && !adminRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }
    
    messages.splice(messageIndex, 1);
    saveChatMessages(messages);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Chat delete error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Add/remove emoji reaction to a message
app.post('/api/chat/:id/reaction', verifyToken, (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    
    if (!emoji || emoji.length === 0) {
      return res.status(400).json({ error: 'Emoji required' });
    }
    
    let messages = loadChatMessages();
    const messageIndex = messages.findIndex(m => m.id === id);
    
    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const message = messages[messageIndex];
    if (!message.reactions) {
      message.reactions = {};
    }
    
    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }
    
    const userIndex = message.reactions[emoji].indexOf(req.username);
    if (userIndex > -1) {
      message.reactions[emoji].splice(userIndex, 1);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      message.reactions[emoji].push(req.username);
    }
    
    saveChatMessages(messages);
    res.json({ success: true, reactions: message.reactions });
  } catch (error) {
    console.error('Chat reaction error:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Get new messages since a timestamp (for polling)
app.get('/api/chat/since/:timestamp', verifyToken, (req, res) => {
  try {
    const { timestamp } = req.params;
    const since = new Date(timestamp).getTime();
    
    const messages = loadChatMessages();
    const newMessages = messages.filter(m => new Date(m.createdAt).getTime() > since);
    
    res.json({ messages: newMessages });
  } catch (error) {
    console.error('Chat poll error:', error);
    res.status(500).json({ error: 'Failed to get new messages' });
  }
});

// Send typing status
app.post('/api/chat/typing', verifyToken, (req, res) => {
  try {
    const { isTyping } = req.body;
    
    if (isTyping) {
      typingUsers[req.username] = Date.now();
    } else {
      delete typingUsers[req.username];
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Typing status error:', error);
    res.status(500).json({ error: 'Failed to update typing status' });
  }
});

// Get typing users
app.get('/api/chat/typing/users', verifyToken, (req, res) => {
  try {
    const now = Date.now();
    const activeTypingUsers = {};
    
    // Clean up expired typing status
    Object.entries(typingUsers).forEach(([user, timestamp]) => {
      if (now - timestamp < TYPING_TIMEOUT) {
        activeTypingUsers[user] = true;
      } else {
        delete typingUsers[user];
      }
    });
    
    res.json({ typingUsers: activeTypingUsers });
  } catch (error) {
    console.error('Get typing users error:', error);
    res.status(500).json({ error: 'Failed to get typing users' });
  }
});

// FINAL START
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
