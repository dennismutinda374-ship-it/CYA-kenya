// Global variables
let authToken = null;
let currentUsername = null;
let currentCategory = null;
let currentQuestion = null;
let selectedOptionIndex = null;
let gameStartTime = null;
let timerInterval = null;
let gameActive = false;
let purchasedHints = {}; // Track which hints have been purchased: { questionId: [hintIndex, ...] }
const timeLimit = 30; // 30 seconds per question

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadCategories();
});

function setupEventListeners() {
  // Login form submission
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });

  // Signup form submission
  document.getElementById('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSignup();
  });
}

// Toggle between login and signup forms
function toggleForms() {
  const loginForm = document.querySelector('.login-form');
  const signupForm = document.querySelector('.signup-form');
  
  if (loginForm.style.display === 'none') {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
  } else {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
  }
  
  clearAuthErrors();
  return false;
}

function clearAuthErrors() {
  const errorMessage = document.querySelector('.error-message');
  if (errorMessage) {
    errorMessage.classList.remove('show');
  }
}

function showError(message, containerId = 'authContainer') {
  const container = document.getElementById(containerId);
  let errorEl = container.querySelector('.error-message');
  
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    container.insertBefore(errorEl, container.firstChild);
  }
  
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

function showSuccess(message, containerId = 'gameContainer') {
  const container = document.getElementById(containerId);
  let successEl = container.querySelector('.success-message');
  
  if (!successEl) {
    successEl = document.createElement('div');
    successEl.className = 'success-message';
    container.insertBefore(successEl, container.firstChild);
  }
  
  successEl.textContent = message;
  successEl.classList.add('show');
  
  setTimeout(() => {
    successEl.classList.remove('show');
  }, 3000);
}

// Handle login
async function handleLogin() {
  clearAuthErrors();
  
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showError('Please fill in all fields');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    authToken = data.token;
    currentUsername = data.username;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('username', currentUsername);

    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';

    document.getElementById('playerName').textContent = currentUsername;
    updateStatsDisplay(data.stats);

    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';

    loadCategories();
  } catch (error) {
    showError(error.message);
  }
}

// Handle signup
async function handleSignup() {
  clearAuthErrors();
  
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!username || !password || !confirmPassword) {
    showError('Please fill in all fields');
    return;
  }

  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return;
  }

  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    authToken = data.token;
    currentUsername = data.username;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('username', currentUsername);

    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';

    document.getElementById('playerName').textContent = currentUsername;
    updateStatsDisplay(data.stats);

    document.getElementById('signupUsername').value = '';
    document.getElementById('signupPassword').value = '';
    document.getElementById('confirmPassword').value = '';

    loadCategories();
  } catch (error) {
    showError(error.message);
  }
}

// Update stats display
function updateStatsDisplay(stats) {
  document.getElementById('balance').textContent = '$' + stats.balance.toFixed(2);
  document.getElementById('totalGames').textContent = stats.totalGamesPlayed;
  document.getElementById('totalWins').textContent = stats.totalWins;
  document.getElementById('totalLosses').textContent = stats.totalLosses;

  const winRate = stats.totalGamesPlayed > 0
    ? ((stats.totalWins / stats.totalGamesPlayed) * 100).toFixed(1)
    : '0';
  document.getElementById('winRate').textContent = winRate + '%';
  document.getElementById('todayGames').textContent = stats.gamesWonToday;
}

// Load and display categories
async function loadCategories() {
  if (!authToken) return;

  try {
    const response = await fetch('/api/categories', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load categories');
    }

    displayCategories(data.categories);
  } catch (error) {
    showError(error.message, 'gameContainer');
  }
}

function displayCategories(categories) {
  const categoryGrid = document.getElementById('categoryGrid');
  categoryGrid.innerHTML = '';

  categories.forEach(category => {
    const button = document.createElement('button');
    button.className = 'category-button';
    button.innerHTML = `
      <span class="category-button-icon">${category.icon}</span>
      <span>${category.name}</span>
    `;
    button.onclick = () => startGame(category.id);
    categoryGrid.appendChild(button);
  });

  // Show setup, hide gameplay
  document.getElementById('gameSetup').style.display = 'block';
  document.getElementById('gamePlay').style.display = 'none';
  document.getElementById('gameResult').style.display = 'none';
}

// Start a game in selected category
async function startGame(categoryId) {
  if (!authToken || gameActive) return;

  gameActive = true;
  currentCategory = categoryId;
  gameStartTime = Date.now();
  selectedOptionIndex = null;
  purchasedHints = {}; // Reset purchased hints for this game

  document.getElementById('gameSetup').style.display = 'none';
  document.getElementById('gamePlay').style.display = 'block';
  document.getElementById('gameResult').style.display = 'none';

  // Update category display
  const categoryNames = {
    'programming': '💻 Programming',
    'medicine': '⚕️ Medicine',
    'law': '⚖️ Law',
    'finance': '💰 Finance',
    'marketing': '📢 Marketing',
    'design': '🎨 Design',
    'psychology': '🧠 Psychology',
    'biology': '🧬 Biology',
    'Religion': '⛪ christian',
  };
  document.getElementById('currentCategory').textContent = categoryNames[categoryId];

  // Disable submit button until option selected
  document.getElementById('submitAnswerBtn').disabled = true;

  try {
    const response = await fetch(`/api/get-question?category=${categoryId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load question');
    }

    currentQuestion = data;
    displayQuestion(data);
    startTimer();
  } catch (error) {
    showError(error.message, 'gameContainer');
    gameActive = false;
    loadCategories();
  }
}

function displayQuestion(questionData) {
  document.getElementById('questionText').textContent = questionData.question;

  const optionsContainer = document.getElementById('optionsContainer');
  optionsContainer.innerHTML = '';

  questionData.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'option-button';
    button.textContent = option;
    button.onclick = () => selectOption(index, button);
    optionsContainer.appendChild(button);
  });

  // Display hints if available
  if (questionData.hints && questionData.hints.length > 0) {
    let hintsContainer = document.getElementById('hintsContainer');
    if (!hintsContainer) {
      // Create hints container if it doesn't exist
      const newHintsContainer = document.createElement('div');
      newHintsContainer.id = 'hintsContainer';
      newHintsContainer.className = 'hints-container';
      optionsContainer.parentNode.insertBefore(newHintsContainer, optionsContainer.nextSibling);
      hintsContainer = newHintsContainer;
    }

    hintsContainer.innerHTML = '<div class="hints-title">💡 Hints Available:</div>';

    questionData.hints.forEach((hint, index) => {
      const hintButton = document.createElement('button');
      hintButton.className = 'hint-button';
      const purchased = purchasedHints[questionData.questionId] && purchasedHints[questionData.questionId].includes(index);
      hintButton.innerHTML = purchased 
        ? `<span class="hint-text">${hint.text}</span>` 
        : `<span class="hint-cost">-${hint.cost} pts</span>`;
      hintButton.disabled = purchased;
      hintButton.onclick = () => purchaseHint(questionData.questionId, index, hint.cost, hintButton, hint.text);
      hintsContainer.appendChild(hintButton);
    });
  }
}

function selectOption(index, button) {
  if (!gameActive) return;

  // Deselect previous option
  const previousSelected = document.querySelector('.option-button.selected');
  if (previousSelected) {
    previousSelected.classList.remove('selected');
  }

  // Select new option
  selectedOptionIndex = index;
  button.classList.add('selected');

  // Enable submit button
  document.getElementById('submitAnswerBtn').disabled = false;
}

function startTimer() {
  let timeRemaining = timeLimit;
  updateTimerDisplay(timeRemaining);

  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay(timeRemaining);

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      gameActive = false;
      handleTimeUp();
    }
  }, 1000);
}

async function handleTimeUp() {
  const timeTaken = timeLimit;
  
  try {
    const response = await fetch('/api/play-game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        isCorrect: false,
        timeTaken: timeTaken
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Game submission failed');
    }

    // Fetch updated stats
    const statsResponse = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const statsData = await statsResponse.json();
    
    endGame(false, 'Time\'s up!', 0, timeTaken, 0, statsData);
  } catch (error) {
    showError(error.message, 'gameContainer');
    loadCategories();
  }
}

function updateTimerDisplay(seconds) {
  document.getElementById('timer').textContent = seconds + 's';
  
  const timerBox = document.querySelector('.timer-box');
  if (seconds <= 10) {
    timerBox.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
  } else if (seconds <= 5) {
    timerBox.style.background = 'linear-gradient(135deg, #c0392b 0%, #a93226 100%)';
    document.getElementById('timer').style.animation = 'pulse 0.5s infinite';
  }
}

async function submitAnswer() {
  if (!gameActive || selectedOptionIndex === null) return;

  clearInterval(timerInterval);
  gameActive = false;

  const timeTaken = Math.round((Date.now() - gameStartTime) / 1000);
  const isCorrect = selectedOptionIndex === currentQuestion.correctIndex;

  try {
    const response = await fetch('/api/play-game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        isCorrect: isCorrect,
        timeTaken: timeTaken
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Game submission failed');
    }

    // Fetch updated stats
    const statsResponse = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const statsData = await statsResponse.json();
    
    endGame(isCorrect, null, data.pointsEarned, timeTaken, data.newBalance, statsData);
  } catch (error) {
    showError(error.message, 'gameContainer');
    loadCategories();
  }
}

async function purchaseHint(questionId, hintIndex, cost, hintButton, hintText) {
  if (!authToken || !gameActive) return;

  try {
    const response = await fetch('/api/buy-hint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        hintCost: cost
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'Failed to purchase hint', 'gameContainer');
      return;
    }

    // Track this hint as purchased
    if (!purchasedHints[questionId]) {
      purchasedHints[questionId] = [];
    }
    purchasedHints[questionId].push(hintIndex);

    // Update button to show hint text
    hintButton.innerHTML = `<span class="hint-text">${hintText}</span>`;
    hintButton.disabled = true;

    // Update balance display
    document.getElementById('balance').textContent = data.newBalance.toFixed(2);
    
    showSuccess(`Hint purchased! New balance: $${data.newBalance.toFixed(2)}`, 'gameContainer');
  } catch (error) {
    showError('Error purchasing hint', 'gameContainer');
  }
}

function endGame(isCorrect, timeoutMessage = null, pointsEarned = 0, timeTaken = 0, newBalance = 0, stats = null) {
  gameActive = false;
  clearInterval(timerInterval);

  document.getElementById('gamePlay').style.display = 'none';
  document.getElementById('gameResult').style.display = 'block';

  const resultDiv = document.getElementById('gameResult');
  const resultText = document.getElementById('resultText');
  const rewardText = document.getElementById('rewardText');

  if (timeoutMessage) {
    resultDiv.className = 'game-result loss';
    resultText.textContent = timeoutMessage;
    rewardText.textContent = `The correct answer was: ${currentQuestion.options[currentQuestion.correctIndex]}`;
  } else if (isCorrect) {
    resultDiv.className = 'game-result';
    resultText.textContent = '🎉 Correct! Well Done!';
    rewardText.textContent = `You earned ${pointsEarned} points in ${timeTaken} seconds! New Balance: $${newBalance.toFixed(2)}`;
  } else {
    resultDiv.className = 'game-result loss';
    resultText.textContent = '❌ Wrong Answer';
    rewardText.textContent = `The correct answer was: ${currentQuestion.options[currentQuestion.correctIndex]}`;
  }

  // Update stats display if provided
  if (stats) {
    updateStatsDisplay(stats);
  }

  // Reset timer display
  document.querySelector('.timer-box').style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  document.getElementById('timer').style.animation = 'none';
}

// Logout
function logout() {
  authToken = null;
  currentUsername = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('username');

  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('signupUsername').value = '';
  document.getElementById('signupPassword').value = '';
  document.getElementById('confirmPassword').value = '';

  document.getElementById('authContainer').style.display = 'block';
  document.getElementById('gameContainer').style.display = 'none';

  const loginForm = document.querySelector('.login-form');
  const signupForm = document.querySelector('.signup-form');
  loginForm.style.display = 'block';
  signupForm.style.display = 'none';

  clearAuthErrors();
}

// Check if user is already logged in on page load
window.addEventListener('load', () => {
  const storedToken = localStorage.getItem('authToken');
  const storedUsername = localStorage.getItem('username');

  if (storedToken && storedUsername) {
    authToken = storedToken;
    currentUsername = storedUsername;

    fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Token expired');
      }
    })
    .then(stats => {
      document.getElementById('authContainer').style.display = 'none';
      document.getElementById('gameContainer').style.display = 'block';
      document.getElementById('playerName').textContent = currentUsername;
      updateStatsDisplay(stats);
      loadCategories();
    })
    .catch(error => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
      authToken = null;
      currentUsername = null;
    });
  }
});
// Sample leaderboard data (in real app, fetch from server)
let leaderboardData = [
    { username: "Player1", wins: 12, winRate: 80, balance: 150 },
    { username: "Player2", wins: 10, winRate: 71, balance: 120 },
    { username: "Player3", wins: 8, winRate: 66, balance: 100 },
    { username: "Player4", wins: 5, winRate: 50, balance: 60 },
];

// Function to update leaderboard
function updateLeaderboard(category, data) {
    document.getElementById('leaderboardCategory').textContent = category;
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = ''; // Clear previous rows

    data.sort((a, b) => b.wins - a.wins); // Sort by wins descending

    data.forEach((player, index) => {
        const row = `<tr>
            <td>${index + 1}</td>
            <td>${player.username}</td>
            <td>${player.wins}</td>
            <td>${player.winRate}%</td>
            <td>$${player.balance.toFixed(2)}</td>
        </tr>`;
        tbody.innerHTML += row;
    });

    document.getElementById('leaderboardContainer').style.display = 'block';
}

// Call this after game ends
function showGameResult(resultText, reward, category) {
    document.getElementById('gameResult').style.display = 'block';
    document.getElementById('resultText').textContent = resultText;
    document.getElementById('rewardText').textContent = reward;

    // Update leaderboard for this category
    updateLeaderboard(category, leaderboardData);
}
const DB_PATH = path.join(__dirname, "data", "users.json");

// =======================================================
//  DATABASE HELPERS
// =======================================================
function loadDB() {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 4));
}

// Automatically create missing fields
function ensureUserDefaults(db, username) {
    if (!db[username]) db[username] = {};
    if (db[username].balance == null) db[username].balance = 0;
    if (db[username].wins == null) db[username].wins = 0;
    if (db[username].losses == null) db[username].losses = 0;
    return db;
}

// =======================================================
//  SUPER USER HANDLER
// =======================================================
function isSuperUser(username) {
    return username === "dennie"; // master account
}

function requireSuperUser(req, res, next) {
    const username = req.headers['x-admin'];

    if (!username || !isSuperUser(username)) {
        return res.status(403).json({ message: "Access denied: Super user only" });
    }
    next();
}

// =======================================================
//  ADMIN ROUTES (ALL FIXED + PROTECTED)
// =======================================================

// Reset user
app.post('/admin/reset', requireSuperUser, (req, res) => {
    const { username } = req.body;
    const db = loadDB();

    if (!db[username]) return res.status(404).json({ message: "User not found" });

    db[username].balance = 0;
    db[username].wins = 0;
    db[username].losses = 0;

    saveDB(db);
    res.json({ message: `Player ${username} reset successfully` });
});

// Add balance
app.post('/admin/addbalance', requireSuperUser, (req, res) => {
    const { username, amount } = req.body;
    let db = loadDB();

    if (!db[username]) return res.status(404).json({ message: "User not found" });

    db = ensureUserDefaults(db, username);
    db[username].balance += Number(amount);

    saveDB(db);
    res.json({ message: `Added $${amount} to ${username}` });
});

// Deduct balance
app.post('/admin/deductbalance', requireSuperUser, (req, res) => {
    const { username, amount } = req.body;
    let db = loadDB();

    if (!db[username]) return res.status(404).json({ message: "User not found" });

    db = ensureUserDefaults(db, username);
    db[username].balance -= Number(amount);

    if (db[username].balance < 0) db[username].balance = 0;

    saveDB(db);
    res.json({ message: `Deducted $${amount} from ${username}` });
});

// View users
app.get('/data/users', requireSuperUser, (req, res) => {
    const db = loadDB();

    const allUsers = Object.entries(db).map(([username, d]) => ({
        username,
        balance: d.balance || 0,
        wins: d.wins || 0,
        losses: d.losses || 0
    }));

    res.json(allUsers);
});