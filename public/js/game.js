// Game Page JavaScript with Modal UI
let authToken = null;
let currentUsername = null;
let currentCategory = null;
let currentQuestion = null;
let selectedOptionIndex = null;
let gameStartTime = null;
let timerInterval = null;
let timeRemaining = 30;
let hintPurchased = false;

const categoryNames = {
    'oldTestament': 'Old Testament',
    'newTestament': 'New Testament',
    'jesus': 'Jesus & Gospels',
    'apostles': 'Apostles & Early Church',
    'kings': 'Kings & Rulers',
    'prophets': 'Prophets',
    'parables': 'Parables',
    'miracles': 'Miracles'
};

const categoryIcons = {
    'oldTestament': '📖',
    'newTestament': '📕',
    'jesus': '✝️',
    'apostles': '⛪',
    'kings': '👑',
    'prophets': '🕯️',
    'parables': '📚',
    'miracles': '✨'
};

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

function checkAuth() {
    authToken = localStorage.getItem('authToken');
    currentUsername = localStorage.getItem('username');
    
    if (!authToken || !currentUsername) {
        window.location.href = 'login.html';
        return;
    }
    
    // Setup UI
    document.getElementById('userDisplay').textContent = `${currentUsername}`;
    document.getElementById('userDisplayMobile').textContent = `${currentUsername}`;
    document.getElementById('navMiddle').style.display = 'flex';
    document.getElementById('mobileMenuBtn').style.display = 'flex';
    
    loadStats();
    loadCategories();
    setupScrollNav();
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to load stats');
        
        const stats = await response.json();
        updateStatsDisplay(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updateStatsDisplay(stats) {
    document.getElementById('balance').textContent = (stats.balance || 0).toFixed(0);
    document.getElementById('totalWins').textContent = stats.totalWins || 0;
    document.getElementById('totalLosses').textContent = stats.totalLosses || 0;
    
    const games = stats.totalGamesPlayed || 0;
    const wins = stats.totalWins || 0;
    const winRate = games > 0 ? ((wins / games) * 100).toFixed(0) : 0;
    document.getElementById('winRate').textContent = winRate + '%';
}

async function loadCategories() {
    try {
        const response = await fetch('/api/categories', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to load categories');
        
        const data = await response.json();
        renderCategories(data.categories);
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function renderCategories(categories) {
    const grid = document.getElementById('categoryGrid');
    
    grid.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="startGame('${cat.id}')">
            <span class="category-icon">${cat.icon}</span>
            <span class="category-name">${cat.name}</span>
        </div>
    `).join('');
}

async function startGame(categoryId) {
    currentCategory = categoryId;
    selectedOptionIndex = null;
    hintPurchased = false;
    gameStartTime = Date.now();
    timeRemaining = 30;
    
    // Show modal
    document.getElementById('questionModal').classList.add('active');
    document.getElementById('modalCategory').textContent = categoryNames[categoryId] || categoryId;
    document.getElementById('modalTimer').textContent = '30s';
    document.getElementById('modalTimer').classList.remove('warning');
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('hintBtn').disabled = false;
    document.getElementById('hintBtn').textContent = 'Buy Hint (-10 pts)';
    document.getElementById('hintDisplay').textContent = '';
    
    try {
        const response = await fetch(`/api/get-question?category=${categoryId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to load question');
        
        currentQuestion = await response.json();
        renderQuestion(currentQuestion);
        startTimer();
    } catch (error) {
        console.error('Error starting game:', error);
        closeModal('questionModal');
        alert('Failed to load question. Please try again.');
    }
}

function renderQuestion(question) {
    document.getElementById('modalQuestion').textContent = question.question;
    
    const optionsContainer = document.getElementById('modalOptions');
    const letters = ['A', 'B', 'C', 'D'];
    
    optionsContainer.innerHTML = question.options.map((option, index) => `
        <button class="option-btn" onclick="selectOption(${index}, this)">
            <span class="option-letter">${letters[index]}</span>
            <span>${option}</span>
        </button>
    `).join('');
}

function selectOption(index, btn) {
    // Remove previous selection
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    
    // Select new option
    btn.classList.add('selected');
    selectedOptionIndex = index;
    document.getElementById('submitBtn').disabled = false;
}

function startTimer() {
    clearInterval(timerInterval);
    timeRemaining = 30;
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        document.getElementById('modalTimer').textContent = timeRemaining + 's';
        
        if (timeRemaining <= 5) {
            document.getElementById('modalTimer').classList.add('warning');
        }
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

async function handleTimeUp() {
    try {
        const response = await fetch('/api/play-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                isCorrect: false,
                timeTaken: 30
            })
        });
        
        await response.json();
        showResult(false, 0, 30, "Time's up!");
    } catch (error) {
        console.error('Error submitting timeout:', error);
        showResult(false, 0, 30, "Time's up!");
    }
}

async function submitAnswer() {
    if (selectedOptionIndex === null) return;
    
    clearInterval(timerInterval);
    
    const timeTaken = Math.round((Date.now() - gameStartTime) / 1000);
    const isCorrect = selectedOptionIndex === currentQuestion.correctIndex;
    
    // Show correct/incorrect styling
    const options = document.querySelectorAll('.option-btn');
    options.forEach((btn, index) => {
        if (index === currentQuestion.correctIndex) {
            btn.classList.add('correct');
        } else if (index === selectedOptionIndex && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });
    
    document.getElementById('submitBtn').disabled = true;
    
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
        
        // Wait a moment to show correct answer styling
        setTimeout(() => {
            showResult(isCorrect, data.pointsEarned, timeTaken);
        }, 1000);
        
    } catch (error) {
        console.error('Error submitting answer:', error);
        setTimeout(() => {
            showResult(isCorrect, isCorrect ? 50 : -5, timeTaken);
        }, 1000);
    }
}

function showResult(isCorrect, points, timeTaken, message = null) {
    closeModal('questionModal');
    
    const resultModal = document.getElementById('resultModal');
    const icon = document.getElementById('resultIcon');
    const title = document.getElementById('resultTitle');
    const details = document.getElementById('resultDetails');
    const pointsEl = document.getElementById('resultPoints');
    
    if (message) {
        icon.textContent = '⏰';
        title.textContent = message;
        title.className = 'result-title incorrect';
        details.textContent = `The correct answer was: ${currentQuestion.options[currentQuestion.correctIndex]}`;
        pointsEl.textContent = '-5 points';
        pointsEl.className = 'result-points negative';
    } else if (isCorrect) {
        icon.textContent = '🎉';
        title.textContent = 'Correct!';
        title.className = 'result-title correct';
        details.textContent = `Great job! You answered in ${timeTaken} seconds.`;
        pointsEl.textContent = `+${points} points`;
        pointsEl.className = 'result-points positive';
    } else {
        icon.textContent = '😔';
        title.textContent = 'Wrong Answer';
        title.className = 'result-title incorrect';
        details.textContent = `The correct answer was: ${currentQuestion.options[currentQuestion.correctIndex]}`;
        pointsEl.textContent = `${points} points`;
        pointsEl.className = 'result-points negative';
    }
    
    resultModal.classList.add('active');
    loadStats(); // Refresh stats
}

async function buyHint() {
    if (!currentQuestion.hints || currentQuestion.hints.length === 0 || hintPurchased) return;
    
    const hint = currentQuestion.hints[0];
    
    try {
        const response = await fetch('/api/buy-hint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ hintCost: hint.cost })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            alert(data.error || 'Insufficient balance for hint');
            return;
        }
        
        hintPurchased = true;
        document.getElementById('hintBtn').disabled = true;
        document.getElementById('hintBtn').textContent = 'Hint Purchased';
        document.getElementById('hintDisplay').textContent = hint.text;
        document.getElementById('balance').textContent = data.newBalance.toFixed(0);
        
    } catch (error) {
        console.error('Error buying hint:', error);
        alert('Failed to purchase hint');
    }
}

function playAgain() {
    closeModal('resultModal');
    // Show category selection
}

function goToDashboard() {
    window.location.href = 'dashboard.html';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    clearInterval(timerInterval);
}

function setupScrollNav() {
    const nav = document.getElementById('topNav');
    if (!nav) return;
    
    window.addEventListener('scroll', () => {
        if (window.innerWidth <= 1024) {
            if (window.scrollY > 10) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }
    }, { passive: true });
}

function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    mobileNav.classList.toggle('active');
}

function logoutMobile() {
    logout();
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    window.location.href = 'landing.html';
}
