const nodemailer = require('nodemailer');
const EmailStrategy = require('./emailStrategy');

/**
 * SMTP Email Strategy
 * Handles Gmail, Outlook, and other SMTP providers
 */
class SmtpStrategy extends EmailStrategy {
  constructor() {
    super();
    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize SMTP transporter
   */
  initialize() {
    if (this.isConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  /**
   * Check if SMTP is configured
   */
  isConfigured() {
    return !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );
  }

  /**
   * Send email via SMTP
   */
  async sendEmail(emailConfig) {
    if (!this.transporter) {
      throw new Error('SMTP not configured or initialized');
    }

    const result = await this.transporter.sendMail(emailConfig);
    return { 
      success: true, 
      messageId: result.messageId,
      provider: 'SMTP'
    };
  }

  /**
   * Test SMTP connection
   */
  async testConnection() {
    if (!this.transporter) {
      throw new Error('SMTP not configured');
    }

    await this.transporter.verify();
    return { 
      success: true, 
      message: 'SMTP connection successful',
      provider: 'SMTP'
    };
  }

  /**
   * Get strategy name
   */
  getStrategyName() {
    return 'SMTP';
  }
}

module.exports = SmtpStrategy;
