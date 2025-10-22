const sgMail = require('@sendgrid/mail');
const EmailStrategy = require('./emailStrategy');

/**
 * SendGrid Email Strategy
 * Handles SendGrid API email sending
 */
class SendGridStrategy extends EmailStrategy {
  constructor() {
    super();
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL;
    this.fromName = process.env.FROM_NAME || 'GrowWise';
    this.initialize();
  }

  /**
   * Initialize SendGrid
   */
  initialize() {
    if (this.isConfigured()) {
      sgMail.setApiKey(this.apiKey);
    }
  }

  /**
   * Check if SendGrid is configured
   */
  isConfigured() {
    return !!(
      process.env.SENDGRID_API_KEY &&
      process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key-here' &&
      process.env.FROM_EMAIL
    );
  }

  /**
   * Send email via SendGrid
   */
  async sendEmail(emailConfig) {
    if (!this.isConfigured()) {
      throw new Error('SendGrid not configured');
    }

    const msg = {
      to: emailConfig.to,
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject: emailConfig.subject,
      html: emailConfig.html,
      text: emailConfig.text
    };

    const result = await sgMail.send(msg);
    return { 
      success: true, 
      messageId: result[0].headers['x-message-id'],
      provider: 'SendGrid'
    };
  }

  /**
   * Test SendGrid connection
   */
  async testConnection() {
    if (!this.isConfigured()) {
      throw new Error('SendGrid not configured');
    }

    // Send a test email to verify connection
    const testMsg = {
      to: this.fromEmail,
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject: 'SendGrid Connection Test',
      text: 'This is a test email to verify SendGrid configuration.',
      html: '<p>This is a test email to verify SendGrid configuration.</p>'
    };

    await sgMail.send(testMsg);
    return { 
      success: true, 
      message: 'SendGrid connection successful',
      provider: 'SendGrid'
    };
  }

  /**
   * Get strategy name
   */
  getStrategyName() {
    return 'SendGrid';
  }
}

module.exports = SendGridStrategy;
