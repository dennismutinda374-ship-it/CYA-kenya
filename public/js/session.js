// Session Management - Handles user session timeouts
class SessionManager {
  constructor(options = {}) {
    this.timeoutDuration = options.timeoutDuration || 30 * 60 * 1000; // 30 minutes default
    this.warningDuration = options.warningDuration || 5 * 60 * 1000; // 5 minute warning
    this.timeoutId = null;
    this.warningShown = false;
    this.isActive = true;
    
    this.initSession();
  }

  initSession() {
    const token = localStorage.getItem('authToken');
    if (!token) return; // Not logged in

    this.setupActivityListeners();
    this.startSessionTimeout();
  }

  setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.resetTimeout(), true);
    });
  }

  startSessionTimeout() {
    this.clearTimeout();
    this.warningShown = false;
    
    // Warning appears at: totalTimeout - warningDuration
    const warningTime = this.timeoutDuration - this.warningDuration;
    
    this.timeoutId = setTimeout(() => {
      this.showWarningModal();
    }, warningTime);
  }

  resetTimeout() {
    if (!this.isActive) return;
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      this.logout();
      return;
    }
    
    this.startSessionTimeout();
  }

  showWarningModal() {
    if (this.warningShown) return;
    this.warningShown = true;
    
    // Remove any existing modal
    const existingModal = document.getElementById('sessionWarningModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'sessionWarningModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
    `;
    
    let remainingSeconds = 300;
    const countdownInterval = setInterval(() => {
      remainingSeconds--;
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      const timeDisplay = document.getElementById('sessionCountdown');
      if (timeDisplay) {
        timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);
    
    content.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px;">⏰</div>
      <h2 style="color: #1a365d; margin: 0 0 15px; font-size: 24px; font-weight: 700;">Session Timeout Warning</h2>
      <p style="color: #64748b; margin: 0 0 20px; font-size: 15px;">Your session will expire in:</p>
      <div id="sessionCountdown" style="
        font-size: 48px;
        font-weight: 700;
        color: #dc2626;
        margin: 20px 0;
        font-family: monospace;
      ">5:00</div>
      <p style="color: #64748b; margin: 0 0 25px; font-size: 14px;">Click "Continue Session" to stay logged in, or "Logout" if you're done.</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="continueSessionBtn" style="
          padding: 12px 30px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
        ">Continue Session</button>
        <button id="logoutSessionBtn" style="
          padding: 12px 30px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
        ">Logout</button>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    const continueBtn = document.getElementById('continueSessionBtn');
    const logoutBtn = document.getElementById('logoutSessionBtn');
    
    continueBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      modal.remove();
      this.resetTimeout();
    });
    
    logoutBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      this.logout();
    });
    
    // Auto logout after warning duration
    setTimeout(() => {
      if (modal.parentNode) {
        this.logout();
      }
    }, this.warningDuration);
  }

  clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  logout() {
    this.isActive = false;
    this.clearTimeout();
    
    // Remove warning modal if exists
    const modal = document.getElementById('sessionWarningModal');
    if (modal) modal.remove();
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    
    window.location.href = 'login.html?sessionExpired=true';
  }

  destroy() {
    this.clearTimeout();
    this.isActive = false;
  }
}

// Initialize session manager when page loads
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    window.sessionManager = new SessionManager({
      timeoutDuration: 30 * 60 * 1000, // 30 minutes
      warningDuration: 5 * 60 * 1000   // 5 minute warning
    });
  }
});
