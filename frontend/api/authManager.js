/**
 * Authentication Manager
 * Handles user session, token validation, and authentication state
 */
class AuthManager {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    if (!this.token) {
      return false;
    }

    // Check token expiry
    try {
      const payload = this.decodeToken(this.token);
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        console.log('Token expired');
        this.logout();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      this.logout();
      return false;
    }
  }

  /**
   * Login user and store session
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} - User object
   */
  async login(email, password) {
    try {
      const response = await api.login(email, password);
      this.setSession(response.token, response.user);
      return response.user;
    } catch (error) {
      throw new Error(error.message || 'Login failed');
    }
  }

  /**
   * Register new user and auto-login
   * @param {Object} userData - { email, password, firstName, lastName }
   * @returns {Promise<Object>} - User object
   */
  async register(userData) {
    try {
      const response = await api.register(userData);
      this.setSession(response.token, response.user);
      return response.user;
    } catch (error) {
      throw new Error(error.message || 'Registration failed');
    }
  }

  /**
   * Logout user and clear session
   */
  async logout() {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear session data
      this.token = null;
      this.user = null;
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('performanceAssessment');

      // Redirect to login
      window.location.href = '/login.html';
    }
  }

  /**
   * Set user session data
   * @param {string} token - JWT token
   * @param {Object} user - User object
   */
  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));

    // Update api client token
    if (window.api) {
      window.api.token = token;
    }
  }

  /**
   * Get current user
   * @returns {Object|null} - User object or null
   */
  getUser() {
    return this.user;
  }

  /**
   * Get user's display name
   * @returns {string}
   */
  getUserDisplayName() {
    if (!this.user) return 'User';
    return `${this.user.firstName} ${this.user.lastName}`;
  }

  /**
   * Decode JWT token (client-side, for display purposes only)
   * @param {string} token - JWT token
   * @returns {Object} - Decoded payload
   */
  decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Token decode error:', error);
      throw new Error('Invalid token format');
    }
  }

  /**
   * Get token expiry time
   * @returns {Date|null} - Expiry date or null
   */
  getTokenExpiry() {
    if (!this.token) return null;

    try {
      const payload = this.decodeToken(this.token);
      if (payload.exp) {
        return new Date(payload.exp * 1000);
      }
    } catch (error) {
      console.error('Get token expiry error:', error);
    }

    return null;
  }

  /**
   * Check if token will expire soon (within 1 hour)
   * @returns {boolean}
   */
  isTokenExpiringSoon() {
    const expiry = this.getTokenExpiry();
    if (!expiry) return false;

    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    return expiry < oneHourFromNow;
  }

  /**
   * Refresh user data from server
   * @returns {Promise<Object>} - Updated user object
   */
  async refreshUser() {
    try {
      const response = await api.getCurrentUser();
      this.user = response.user;
      localStorage.setItem('user', JSON.stringify(response.user));
      return response.user;
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  }

  /**
   * Redirect to login if not authenticated
   * @param {string} returnUrl - URL to return to after login
   */
  requireAuth(returnUrl = null) {
    if (!this.isAuthenticated()) {
      const url = returnUrl ? `/login.html?returnUrl=${encodeURIComponent(returnUrl)}` : '/login.html';
      window.location.href = url;
      return false;
    }
    return true;
  }

  /**
   * Initialize auth checking (call on page load)
   * Checks token expiry and sets up warning if expiring soon
   */
  init() {
    if (this.isAuthenticated()) {
      // Check if token is expiring soon
      if (this.isTokenExpiringSoon()) {
        console.warn('Authentication token will expire soon');
        // Could show a notification to user here
      }
    }
  }
}

// Create singleton instance
const authManager = new AuthManager();

// Export for use in other modules
window.authManager = authManager;
