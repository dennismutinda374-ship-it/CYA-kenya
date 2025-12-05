/**
 * Progressive Web App Install Prompt Handler
 * Manages the "Add to Home Screen" functionality
 */

let deferredPrompt;
const INSTALL_PROMPT_KEY = 'cya-install-prompt-dismissed';
const INSTALL_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

class AppInstallPrompt {
  constructor() {
    this.promptElement = null;
    this.isSupported = 'beforeinstallprompt' in window;
    this.isInstalled = this.checkIfInstalled();
    this.init();
  }

  init() {
    if (!this.isSupported || this.isInstalled) {
      return;
    }

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      this.showPrompt();
    });

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      this.onAppInstalled();
    });

    // Check if app is already installed
    if (navigator.getInstalledRelatedApps) {
      navigator.getInstalledRelatedApps().then((apps) => {
        if (apps.length > 0) {
          this.onAppInstalled();
        }
      });
    }
  }

  checkIfInstalled() {
    // Check if running as standalone app
    if (window.navigator.standalone === true) {
      return true;
    }

    // Check if in Trusted Web Activity
    const isTWA = window.matchMedia('(display-mode: fullscreen)').matches ||
                  window.matchMedia('(display-mode: standalone)').matches;
    
    return isTWA;
  }

  showPrompt() {
    // Check if user dismissed recently
    const lastDismissed = localStorage.getItem(INSTALL_PROMPT_KEY);
    if (lastDismissed) {
      const timeSinceLastDismiss = Date.now() - parseInt(lastDismissed);
      if (timeSinceLastDismiss < INSTALL_CHECK_INTERVAL) {
        return;
      }
    }

    // Create and inject install prompt UI
    this.createPromptUI();
  }

  createPromptUI() {
    // Create container
    const container = document.createElement('div');
    container.id = 'cya-install-prompt';
    container.className = 'cya-install-prompt';
    container.innerHTML = `
      <div class="cya-install-content">
        <div class="cya-install-icon">📱</div>
        <div class="cya-install-text">
          <h3>Install CYA App</h3>
          <p>Add CYA to your home screen for quick access</p>
        </div>
        <div class="cya-install-actions">
          <button class="cya-install-btn cya-install-yes" id="cya-install-yes">Install</button>
          <button class="cya-install-btn cya-install-no" id="cya-install-no">Later</button>
        </div>
        <button class="cya-install-close" id="cya-install-close">✕</button>
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('cya-install-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'cya-install-styles';
      styleElement.textContent = this.getStyles();
      document.head.appendChild(styleElement);
    }

    // Add to DOM
    document.body.appendChild(container);

    // Add event listeners
    document.getElementById('cya-install-yes')?.addEventListener('click', () => this.promptToInstall());
    document.getElementById('cya-install-no')?.addEventListener('click', () => this.dismissPrompt());
    document.getElementById('cya-install-close')?.addEventListener('click', () => this.dismissPrompt());

    // Auto-hide after 10 seconds if not interacted
    setTimeout(() => {
      const prompt = document.getElementById('cya-install-prompt');
      if (prompt && !this.isInstalled) {
        prompt.classList.add('fade-out');
        setTimeout(() => prompt?.remove(), 300);
      }
    }, 10000);
  }

  promptToInstall() {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();

    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        this.onAppInstalled();
      } else {
        this.dismissPrompt();
      }
      deferredPrompt = null;
    });
  }

  dismissPrompt() {
    localStorage.setItem(INSTALL_PROMPT_KEY, Date.now().toString());
    const container = document.getElementById('cya-install-prompt');
    if (container) {
      container.classList.add('fade-out');
      setTimeout(() => container.remove(), 300);
    }
  }

  onAppInstalled() {
    this.isInstalled = true;
    localStorage.removeItem(INSTALL_PROMPT_KEY);
    
    // Remove prompt if visible
    const container = document.getElementById('cya-install-prompt');
    if (container) {
      container.remove();
    }

    // Show success message (optional)
    if (typeof showNotification === 'function') {
      showNotification('✓ CYA app installed successfully!', 'success');
    }
  }

  getStyles() {
    return `
      #cya-install-prompt {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        border-top: 2px solid #667eea;
        box-shadow: 0 -5px 40px rgba(0, 0, 0, 0.16);
        z-index: 9999;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      #cya-install-prompt.fade-out {
        animation: slideDown 0.3s ease forwards;
      }

      @keyframes slideDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }

      .cya-install-content {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 16px 20px;
        position: relative;
        max-width: 100%;
      }

      .cya-install-icon {
        font-size: 32px;
        flex-shrink: 0;
      }

      .cya-install-text {
        flex: 1;
        min-width: 0;
      }

      .cya-install-text h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1a365d;
      }

      .cya-install-text p {
        margin: 4px 0 0 0;
        font-size: 12px;
        color: #718096;
      }

      .cya-install-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .cya-install-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .cya-install-yes {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .cya-install-yes:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .cya-install-no {
        background: #e2e8f0;
        color: #4a5568;
      }

      .cya-install-no:hover {
        background: #cbd5e0;
      }

      .cya-install-close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #a0aec0;
        padding: 4px 8px;
        transition: color 0.2s ease;
      }

      .cya-install-close:hover {
        color: #718096;
      }

      @media (max-width: 480px) {
        .cya-install-content {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
        }

        .cya-install-actions {
          width: 100%;
          flex-direction: column;
        }

        .cya-install-btn {
          width: 100%;
        }

        .cya-install-close {
          top: 4px;
          right: 4px;
        }
      }
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AppInstallPrompt();
  });
} else {
  new AppInstallPrompt();
}
