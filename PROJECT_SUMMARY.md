# 🎮 WEB GAME - PROJECT SUMMARY

## Project Overview

**Secure Web Gaming Platform** - A Node.js/Express web application with encrypted user authentication, game mechanics, and earning rewards system.

**Developer:** dennie-softs  
**Version:** 1.0.0  
**License:** MIT

---

## ✨ Key Features

### 🔐 Authentication System
- **Secure Login** - Users login with username and password
- **Sign-up System** - Create new accounts with validation
- **Password Hashing** - bcryptjs with 10-round salt
- **JWT Sessions** - Token-based authentication (24-hour expiration)
- **Protected Routes** - All game endpoints require valid token

### 🎲 Game Mechanics
- **Simple Gameplay** - Click button to play (50% win probability)
- **Reward System** - Win: +50 credits, Loss: -10 credits
- **Starting Balance** - 100 credits per new account
- **Min Balance** - Cannot go below 0
- **Real-time Updates** - Balance updates immediately after each game

### 📊 Statistics & Tracking
- **Game Count** - Total games played, wins, and losses
- **Win Rate** - Percentage of games won
- **Daily Tracking** - Games won today counter
- **Balance Display** - Real-time balance updates
- **History** - Permanent game history per account

### 🔒 Security Features
- **Data Encryption** - AES-256-CBC for all user statistics
- **Password Security** - Bcrypt hashing (never plain text)
- **Token Verification** - JWT validation on protected routes
- **Secure Storage** - Encrypted JSON files
- **No Session DB** - Stateless auth reduces attack surface

---

## 📁 Project Structure

```
web game/
│
├── server/
│   └── app.js                    # Express server + authentication
│
├── public/
│   ├── index.html                # Login/Game UI
│   ├── css/
│   │   └── style.css             # Responsive styling
│   └── js/
│       └── app.js                # Frontend logic & API calls
│
├── data/
│   └── users.json                # Encrypted user database (auto-created)
│
├── package.json                  # Node.js dependencies
├── .gitignore                    # Git ignore file
├── README.md                     # Full documentation
├── QUICKSTART.md                 # Quick start guide
├── SECURITY.md                   # Security documentation
├── run.bat                       # Windows batch startup script
└── PROJECT_SUMMARY.md            # This file
```

---

## 🚀 Getting Started

### System Requirements
- Node.js v12+ installed
- Windows/Mac/Linux
- Modern web browser
- 5MB disk space

### Quick Setup (3 steps)

1. **Double-click `run.bat`** (Windows)
   - Or run in PowerShell: `cd "path\to\web game" ; npm install ; npm start`

2. **Wait for server to start**
   - See: "🎮 Web Game Server running on http://localhost:3000"

3. **Open browser to http://localhost:3000**
   - Create account or login

---

## 💻 Technology Stack

| Component | Technology | Details |
|-----------|-----------|---------|
| **Backend** | Node.js + Express | Server & API |
| **Frontend** | HTML5 + CSS3 + Vanilla JS | No frameworks |
| **Auth** | JWT + bcryptjs | Secure sessions |
| **Encryption** | AES-256-CBC | Data protection |
| **Database** | JSON + Crypto | File-based encrypted storage |
| **Hashing** | Bcryptjs (10 rounds) | Password security |

---

## 🎮 How to Play

1. **Create Account**
   - Sign up with username (min. 1 char)
   - Password (min. 6 chars)
   - Confirm password

2. **Login**
   - Enter your credentials
   - Receive 24-hour JWT token
   - Redirected to game dashboard

3. **Play Game**
   - Click "PLAY GAME" button
   - Get result: Win (🎉) or Lose (😞)
   - Balance updates immediately
   - Repeat to earn more!

4. **View Statistics**
   - Total games played
   - Win/loss count
   - Win rate percentage
   - Games won today

5. **Logout**
   - Click "Logout" button
   - Token invalidated
   - Return to login screen

---

## 📊 Game Economics

| Action | Result | Value |
|--------|--------|-------|
| **Win** | Earn credits | +50 |
| **Loss** | Lose credits | -10 |
| **Starting Balance** | New account | 100 |
| **Win Probability** | Per game | 50% |
| **Minimum Balance** | Game rule | 0 |

**Example Session:**
- Start: $100
- Win game 1: +50 = $150
- Lose game 2: -10 = $140
- Win game 3: +50 = $190
- Win game 4: +50 = $240

---

## 🔒 Security Implementation

### Password Protection
```
User Password → bcrypt (10 rounds) → Hash Stored
Login → Compare hashes → Grant token
```

### Data Encryption
```
Stats Object → JSON → AES-256-CBC → Random IV + Ciphertext → Stored
Retrieve → Decrypt with IV → Parse JSON → Use data
```

### API Authentication
```
Request → Extract JWT → Verify signature → Check expiration → Access granted
Invalid/Expired → Return 401 Unauthorized
```

---

## 📋 API Endpoints

### Public Endpoints
```
POST /api/signup
  Input: { username, password }
  Output: { token, username, stats }

POST /api/login
  Input: { username, password }
  Output: { token, username, stats }
```

### Protected Endpoints (Require JWT Token)
```
GET /api/stats
  Headers: Authorization: Bearer <token>
  Output: { totalGamesPlayed, totalWins, totalLosses, balance, ... }

POST /api/play-game
  Headers: Authorization: Bearer <token>
  Input: { result: "win" | "loss" }
  Output: { message, reward, stats }
```

---

## 📊 User Data Storage

**File:** `data/users.json`

**Format (Encrypted):**
```json
{
  "username1": {
    "password": "bcrypt_hash_...",
    "stats": "iv:encrypted_aes256_data",
    "createdAt": "2025-11-26T12:34:56.789Z"
  },
  "username2": { ... }
}
```

**Decrypted Stats Look Like:**
```json
{
  "totalGamesPlayed": 15,
  "totalWins": 9,
  "totalLosses": 6,
  "balance": 380,
  "gamesWonToday": 2,
  "joinDate": "2025-11-26T10:00:00.000Z"
}
```

---

## ⚙️ Configuration

### Server Settings
```javascript
PORT = 3000
SECRET_KEY = 'dennie-softs-secure-key-2025'
TOKEN_EXPIRY = '24h'
BCRYPT_ROUNDS = 10
```

### Encryption Settings
```javascript
ALGORITHM = 'aes-256-cbc'
KEY_LENGTH = 32 bytes (256 bits)
IV_LENGTH = 16 bytes (128 bits)
```

### Customize In Code
Edit `server/app.js`:
- Line 10: Change PORT
- Line 11: Change SECRET_KEY
- Line 100: Change win reward (50)
- Line 102: Change loss penalty (10)
- Line 90: Change starting balance (100)

---

## 🧪 Testing the Application

### Test Account
After installation, create test accounts:
- Username: `testuser`
- Password: `test1234`

### Test Scenarios
1. **Signup Test**
   - Create new user
   - Verify stats initialized
   - Check encrypted storage

2. **Login Test**
   - Wrong password (should fail)
   - Correct credentials (should succeed)
   - Token valid for 24 hours

3. **Game Test**
   - Play multiple games
   - Track balance changes
   - Verify statistics update

4. **Logout Test**
   - Logout and verify session ends
   - Token no longer works
   - Return to login screen

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3000 in use | Close other Node apps or change PORT in app.js |
| npm install fails | Delete node_modules, run npm install again |
| Can't login | Check username/password match signup |
| Game won't load | Hard refresh (Ctrl+F5) and check console |
| Data not saved | Verify write permissions in project folder |

---

## 🚀 Deployment Recommendations

### For Production:
1. **Use HTTPS** - Install SSL certificate
2. **Rate Limiting** - Prevent brute force attacks
3. **Database** - Use encrypted database instead of JSON
4. **Monitoring** - Log all auth events
5. **Backup** - Regular encrypted backups
6. **2FA** - Add two-factor authentication
7. **Audit Trail** - Keep user action logs
8. **Payment Gateway** - For real money rewards

### Environment Variables:
```bash
NODE_ENV=production
JWT_SECRET=your_super_secret_key
ENCRYPTION_KEY=your_encryption_key
DATABASE_URL=your_database_url
PORT=443  # Use HTTPS port
```

---

## 📝 Code Examples

### Signup in Frontend
```javascript
const response = await fetch('/api/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

const data = await response.json();
localStorage.setItem('authToken', data.token);
```

### Playing a Game
```javascript
const response = await fetch('/api/play-game', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({ result: 'win' })
});
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **README.md** | Complete feature documentation |
| **QUICKSTART.md** | Quick setup guide |
| **SECURITY.md** | Detailed security implementation |
| **PROJECT_SUMMARY.md** | This overview document |

---

## 📈 Future Enhancements

- [ ] Multiplayer games
- [ ] Leaderboards
- [ ] Daily challenges
- [ ] Achievements/Badges
- [ ] Email verification
- [ ] Password recovery
- [ ] Payment integration
- [ ] Mobile app version
- [ ] Social features
- [ ] Advanced statistics

---

## 👤 Support & Contact

**Developer:** dennie-softs  
**Project:** Secure Web Game Platform  
**Version:** 1.0.0  
**License:** MIT License

---

## ✅ Checklist Before Running

- [ ] Node.js installed and in PATH
- [ ] Project folder accessible
- [ ] No port 3000 conflicts
- [ ] Run `npm install` (or use run.bat)
- [ ] Browser ready to go to localhost:3000
- [ ] Ready to create account and play!

---

**Ready to play? Run `npm start` or double-click `run.bat`!**

🎮 Have fun gaming! 🎮
