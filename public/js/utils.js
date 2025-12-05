/**
 * Shared Utility Functions - Optimized for Performance
 * Loaded once and reused across all pages
 */

// Request debouncing for API calls
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Request throttling
const throttle = (func, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Cached API requests
const apiCache = new Map();
const cacheRequest = async (url, options = {}, ttl = 5000) => {
  const cacheKey = url + JSON.stringify(options);
  const cached = apiCache.get(cacheKey);
  
  if (cached && Date.now() - cached.time < ttl) {
    return cached.data;
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  apiCache.set(cacheKey, { data, time: Date.now() });
  
  // Auto-expire cache
  setTimeout(() => apiCache.delete(cacheKey), ttl);
  
  return data;
};

// Lazy load images
const lazyLoadImages = () => {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });
    document.querySelectorAll('img.lazy').forEach(img => observer.observe(img));
  }
};

// Batch DOM updates
const batchDOMUpdates = (updates) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

// Fast DOM query with caching
const cachedSelectors = {};
const querySelector = (selector) => {
  if (!cachedSelectors[selector]) {
    cachedSelectors[selector] = document.querySelector(selector);
  }
  return cachedSelectors[selector];
};

// Clear selector cache
const clearSelectorCache = () => Object.keys(cachedSelectors).forEach(key => delete cachedSelectors[key]);
