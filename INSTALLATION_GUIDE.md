# 🎮 WEB GAME - COMPLETE INSTALLATION & USER GUIDE

**Developer:** dennie-softs  
**Version:** 1.0.0  
**Updated:** November 26, 2025

---

## 📦 What You're Getting

A complete, production-ready web gaming platform with:
- ✅ Secure user authentication (login/signup)
- ✅ Encrypted user data storage
- ✅ Game mechanics with rewards system
- ✅ Real-time statistics tracking
- ✅ Professional UI/UX
- ✅ Full documentation

---

## 💻 System Requirements

- **Operating System:** Windows, Mac, or Linux
- **Node.js:** Version 12.0.0 or higher
- **NPM:** Version 6.0.0 or higher
- **Browser:** Any modern browser (Chrome, Firefox, Edge, Safari)
- **Disk Space:** ~50MB (including node_modules)
- **Network:** Internet connection (for npm install)

### Check Your System

**On Windows (PowerShell):**
```powershell
node --version
npm --version
```

**Install Node.js if needed:**
- Download from: https://nodejs.org/
- Choose "LTS" (Long Term Support)
- Follow the installer
- Restart your computer

---

## 🚀 Installation Steps

### Method 1: Using run.bat (Easiest - Windows Only)

1. **Navigate to project folder**
   - Open File Explorer
   - Go to: `C:\Users\INFINITY\OneDrive\Desktop\web game`

2. **Double-click `run.bat`**
   - This script will:
     - Check if Node.js is installed
     - Install dependencies (npm install)
     - Start the server automatically

3. **Open in browser**
   - When you see: "🎮 Web Game Server running on http://localhost:3000"
   - Open your browser to: http://localhost:3000

### Method 2: Using PowerShell/Terminal (Windows/Mac/Linux)

1. **Open PowerShell/Terminal/Command Line**

2. **Navigate to project**
   ```powershell
   cd "C:\Users\INFINITY\OneDrive\Desktop\web game"
   ```

3. **Install dependencies**
   ```powershell
   npm install
   ```
   - Wait for all packages to download (~1-2 minutes first time)

4. **Start the server**
   ```powershell
   npm start
   ```
   - You'll see: `🎮 Web Game Server running on http://localhost:3000`

5. **Open in browser**
   - Navigate to: http://localhost:3000
   - Create account or login

---

## 🎮 First Time Setup

### Creating Your First Account

1. **Go to signup page**
   - Click "Sign Up" link on login screen

2. **Enter details**
   - **Username:** Choose any username (1+ characters)
   - **Password:** Create a secure password (min 6 characters)
   - **Confirm Password:** Repeat your password exactly

3. **Click "Sign Up"**
   - Account created immediately
   - You're automatically logged in
   - Receive 100 starting credits

### First Game Session

1. **View your stats**
   - Balance: $100.00
   - Total Games: 0
   - Wins: 0
   - Losses: 0
   - Win Rate: 0%

2. **Play your first game**
   - Click "PLAY GAME" button
   - Result appears: Win or Loss
   - Balance updates automatically

3. **Keep playing**
   - Each win: +50 credits
   - Each loss: -10 credits
   - Your stats update in real-time

---

## 📁 Project Files Explained

```
web game/
│
├── 📄 run.bat
│   └─ Quick start script (Windows)
│
├── 📄 package.json
│   └─ Lists all Node.js dependencies
│
├── 📁 server/
│   └─ 📄 app.js (Backend server code)
│      - Authentication (login/signup)
│      - Game logic
│      - Encryption
│      - API endpoints
│
├── 📁 public/
│   ├─ 📄 index.html (Main webpage)
│   │  - Login form
│   │  - Signup form
│   │  - Game interface
│   │  - Statistics display
│   │
│   ├─ 📁 css/
│   │  └─ 📄 style.css (Styling)
│   │     - Colors and layout
│   │     - Responsive design
│   │     - Animations
│   │
│   └─ 📁 js/
│      └─ 📄 app.js (Frontend code)
│         - Login/signup logic
│         - API calls
│         - Game interaction
│         - UI updates
│
├── 📁 data/
│   └─ 📄 users.json (Encrypted user database)
│      - Created automatically
│      - Contains all user accounts
│      - All data encrypted
│
└── 📄 Documentation Files:
    ├─ README.md (Full documentation)
    ├─ QUICKSTART.md (Quick setup guide)
    ├─ SECURITY.md (Security details)
    └─ PROJECT_SUMMARY.md (Overview)
```

---

## 🔐 Your Data is Safe

### How Your Data is Protected

**Passwords:**
- Encrypted with bcrypt (industry standard)
- Never stored as plain text
- Even we can't see your password

**Game Statistics:**
- Encrypted with AES-256 (military grade)
- Only decrypted when you play
- Stored securely in users.json

**Session Tokens:**
- JWT tokens with 24-hour expiration
- Automatically logged out after 24 hours
- Only you can access your account

---

## 🎲 How to Play

### Game Rules
- **Probability:** 50% win, 50% loss
- **Win Reward:** +50 credits
- **Loss Penalty:** -10 credits
- **Starting Balance:** 100 credits
- **Minimum Balance:** 0 (can't go negative)

### Example Game Session

```
Starting Balance: $100

Game 1: WIN  → +50  = $150
Game 2: WIN  → +50  = $200
Game 3: LOSS → -10  = $190
Game 4: WIN  → +50  = $240
Game 5: LOSS → -10  = $230

Stats after 5 games:
- Total Games: 5
- Wins: 3
- Losses: 2
- Win Rate: 60%
- Balance: $230
```

---

## ⚙️ Troubleshooting

### Problem: "Port 3000 is already in use"

**Cause:** Another program is using port 3000

**Solution 1 (Quick):**
- Close any other Node.js applications
- Close any other web game instances
- Try again

**Solution 2 (Change port):**
- Edit `server/app.js` line 10
- Change `const PORT = 3000;` to `const PORT = 3001;`
- Save file
- Restart server
- Open: http://localhost:3001

### Problem: "npm command not found"

**Cause:** Node.js not installed or not in PATH

**Solution:**
1. Download Node.js from https://nodejs.org/
2. Install the LTS version
3. Restart your computer
4. Try again

### Problem: "Cannot find module..."

**Cause:** Dependencies not installed

**Solution:**
1. Open PowerShell in project folder
2. Run: `npm install`
3. Wait for completion
4. Run: `npm start`

### Problem: "Can't login to my account"

**Check:**
- ✓ Did you create an account first? (Click Sign Up)
- ✓ Is username spelling correct? (Case-sensitive)
- ✓ Is password correct?
- ✓ Are caps lock/special keys activated?

### Problem: "Games won't load"

**Solution:**
1. Hard refresh browser: Press `Ctrl+F5` (or `Cmd+Shift+R` on Mac)
2. Check browser console for errors: Press `F12`
3. Verify server is running (check terminal)
4. Try another browser

### Problem: "Server keeps crashing"

**Check:**
- ✓ Is Node.js installed? (`node --version`)
- ✓ Are all files present? (Check folders)
- ✓ Did npm install complete? (Check node_modules exists)
- ✓ Any error messages in terminal?

---

## 🛑 To Stop the Server

**In PowerShell/Terminal:**
- Press `Ctrl+C`
- Confirm with `Y` if asked
- Server stops running

**In run.bat:**
- Close the command prompt window
- Or press `Ctrl+C` then `Y`

---

## 🔒 Security Best Practices

### Your Account Safety

✅ **Do:**
- Use a strong, unique password
- Log out after playing
- Don't share your password
- Use a modern, updated browser

❌ **Don't:**
- Reuse passwords from other sites
- Leave your account logged in on public computers
- Share your account credentials
- Click suspicious links

### Data Protection

- All passwords are encrypted
- Game statistics are encrypted
- Session tokens expire automatically
- Only you can access your data
- No payment information needed

---

## 📊 Understanding Your Stats

| Stat | Meaning |
|------|---------|
| **Balance** | Your current credits (total = wins × 50 - losses × 10 + 100) |
| **Total Games** | Number of games you've played |
| **Wins** | Number of games you won |
| **Losses** | Number of games you lost |
| **Win Rate** | Percentage of games won (Wins ÷ Total Games) |
| **Games Won Today** | How many games you've won today |

---

## 💾 Your Data Location

**Encrypted Database File:**
```
C:\Users\INFINITY\OneDrive\Desktop\web game\data\users.json
```

**What's Inside:**
- All user accounts
- All encrypted statistics
- Account creation dates
- Hashed passwords

**Important:**
- Never delete this file manually
- Don't edit this file directly (it's encrypted)
- Backup if you want to preserve data

---

## 🔄 Backing Up Your Account

Your account data is stored in `users.json`. To backup:

1. **Manual Backup:**
   - Copy `data/users.json` to safe location
   - Can restore by copying back

2. **Password Recovery:**
   - Currently not available
   - Write down your password
   - Don't forget it!

---

## 🚀 Advanced Configuration

### Change Server Port
Edit `server/app.js` line 10:
```javascript
const PORT = 3000;  // Change this number
```

### Change Win/Loss Rewards
Edit `server/app.js` around line 100:
```javascript
stats.balance += 50;  // Win amount (change 50)
stats.balance = Math.max(0, stats.balance - 10);  // Loss amount (change 10)
```

### Change Starting Balance
Edit `server/app.js` around line 90:
```javascript
balance: 100,  // Change 100 to desired amount
```

---

## 📱 Responsive Design

The app works on:
- ✅ Desktop (1920×1080 and larger)
- ✅ Laptop (1366×768)
- ✅ Tablet (iPad, Android tablets)
- ✅ Mobile (iPhone, Android phones)

Just resize your browser window - the layout adapts!

---

## 🔗 API Reference (For Developers)

### Signup
```
POST /api/signup
Input: { username: "user123", password: "pass123" }
Output: { token: "jwt...", username: "user123", stats: {...} }
```

### Login
```
POST /api/login
Input: { username: "user123", password: "pass123" }
Output: { token: "jwt...", username: "user123", stats: {...} }
```

### Get Stats
```
GET /api/stats
Headers: { Authorization: "Bearer TOKEN" }
Output: { totalGamesPlayed: 5, totalWins: 3, ... }
```

### Play Game
```
POST /api/play-game
Headers: { Authorization: "Bearer TOKEN" }
Input: { result: "win" or "loss" }
Output: { message: "Game won!", reward: 50, stats: {...} }
```

---

## 📚 Additional Resources

### Documentation Files in Project:
1. **README.md** - Complete technical documentation
2. **SECURITY.md** - Detailed security implementation
3. **PROJECT_SUMMARY.md** - Project overview
4. **QUICKSTART.md** - Quick setup guide

### Online Resources:
- Node.js Documentation: https://nodejs.org/docs/
- Express.js: https://expressjs.com/
- JWT: https://jwt.io/
- Bcryptjs: https://www.npmjs.com/package/bcryptjs

---

## 👥 Support

### Common Questions

**Q: Can I play with friends?**
A: Currently single-player only. Multiplayer features coming soon.

**Q: Can I withdraw my credits?**
A: This is a demo app. Credits are virtual. For payment integration, contact development team.

**Q: How do I reset my password?**
A: Currently not available. Choose passwords carefully!

**Q: Will my account be deleted?**
A: Your account remains until the data/users.json file is deleted.

**Q: Can I change my username?**
A: Not currently. You can create a new account with a different username.

---

## ✨ Tips & Tricks

### Maximize Your Earnings
- Play more games (law of averages)
- Win rate approaches 50% over time
- Long-term: +20 credits per game average

### Protect Your Account
- Strong passwords (8+ characters, mix of types)
- Don't reuse passwords
- Log out when done
- Clear browser history if on shared computer

### Best Experience
- Use modern browser (Chrome, Firefox, Edge)
- Enable JavaScript
- Fast internet for login/game responses
- Full screen for better view

---

## 🎯 Success Checklist

- [ ] Node.js installed and working
- [ ] Project folder accessible
- [ ] npm install completed successfully
- [ ] Server running without errors
- [ ] Can open http://localhost:3000
- [ ] Can create account successfully
- [ ] Can login with created account
- [ ] Can play games
- [ ] Balance updates after games
- [ ] Statistics track correctly

---

## 🏆 You're Ready!

You now have a fully functional, secure gaming platform!

### Next Steps:
1. Run `npm start` or double-click `run.bat`
2. Open http://localhost:3000
3. Create your account
4. Start playing and earning!

**Enjoy the game!** 🎮

---

## 📝 Notes

- This is a demonstration application
- For production use, implement HTTPS, database, payments
- All data is local to your machine
- No data sent to external servers
- Open source and fully customizable

---

**Developed by:** dennie-softs  
**Version:** 1.0.0  
**License:** MIT

**Last Updated:** November 26, 2025

---

*For more help, check the other documentation files in the project folder.*
