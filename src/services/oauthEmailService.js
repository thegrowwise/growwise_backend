const nodemailer = require('nodemailer');
const { google } = require('googleapis');

/**
 * OAuth2 Email Service - No passwords needed!
 * Uses Google OAuth2 for secure email sending
 */
class OAuthEmailService {
  constructor() {
    this.oauth2Client = null;
    this.transporter = null;
  }

  /**
   * Initialize OAuth2 client
   */
  async initialize() {
    try {
      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Set credentials
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });

      // Create transporter
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.FROM_EMAIL,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
          accessToken: await this.getAccessToken()
        }
      });

      console.log('✅ OAuth2 Email Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ OAuth2 initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Get access token
   */
  async getAccessToken() {
    try {
      const { token } = await this.oauth2Client.getAccessToken();
      return token;
    } catch (error) {
      console.error('❌ Failed to get access token:', error.message);
      throw error;
    }
  }

  /**
   * Send email using OAuth2
   */
  async sendEmail(emailConfig) {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      const result = await this.transporter.sendMail(emailConfig);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ OAuth2 email sending failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test OAuth2 connection
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      await this.transporter.verify();
      return { success: true, message: 'OAuth2 connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new OAuthEmailService();
