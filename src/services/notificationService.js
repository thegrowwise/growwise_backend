const EmailStrategyFactory = require('../strategies/emailStrategyFactory');

/**
 * Configurable Notification Service using Strategy Pattern
 * Supports multiple channels: email, whatsapp, sms
 */
class NotificationService {
  constructor() {
    this.channels = this.initializeChannels();
    this.emailStrategyFactory = new EmailStrategyFactory();
  }

  /**
   * Initialize notification channels based on environment configuration
   */
  initializeChannels() {
    const enabledChannels = process.env.NOTIFICATION_CHANNELS?.split(',') || ['email'];
    const channels = {};

    if (enabledChannels.includes('email')) {
      channels.email = this.sendEmail.bind(this);
    }

    if (enabledChannels.includes('whatsapp')) {
      channels.whatsapp = this.sendWhatsApp.bind(this);
    }

    if (enabledChannels.includes('sms')) {
      channels.sms = this.sendSMS.bind(this);
    }

    return channels;
  }

  /**
   * Send notification through all enabled channels
   * @param {Object} data - Notification data
   * @param {string} type - Type of notification (contact_form, confirmation, etc.)
   */
  async sendNotification(data, type = 'contact_form') {
    const results = {};

    for (const [channel, sendFunction] of Object.entries(this.channels)) {
      try {
        console.log(`📤 Sending ${type} notification via ${channel}`);
        results[channel] = await sendFunction(data, type);
        console.log(`✅ ${channel} notification sent successfully`);
      } catch (error) {
        console.error(`❌ Failed to send ${channel} notification:`, error);
        results[channel] = { success: false, error: error.message };
      }
    }

    return results;
  }

  /**
   * Send email notification using Strategy Pattern
   * @param {Object} data - Email data
   * @param {string} type - Email type
   */
  async sendEmail(data, type) {
    const emailConfig = this.getEmailConfig(data, type);
    
    try {
      const result = await this.emailStrategyFactory.sendEmail(emailConfig);
      return { success: true, messageId: result.messageId, provider: result.provider };
    } catch (error) {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  /**
   * Get email configuration based on type
   * @param {Object} data - Email data
   * @param {string} type - Email type
   */
  getEmailConfig(data, type) {
    const baseConfig = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    };

    switch (type) {
      case 'contact_form':
        return {
          ...baseConfig,
          to: process.env.CONTACT_EMAILS,
          subject: `New Contact Form Submission - ${data.name}`,
          html: this.generateContactFormEmail(data),
          text: this.generateContactFormEmailText(data)
        };

      case 'confirmation':
        return {
          ...baseConfig,
          to: data.email,
          subject: 'Thank you for contacting GrowWise!',
          html: this.generateConfirmationEmail(data),
          text: this.generateConfirmationEmailText(data)
        };

      default:
        throw new Error(`Unknown email type: ${type}`);
    }
  }

  /**
   * Generate HTML email for contact form submission
   */
  generateContactFormEmail(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1F396D;">New Contact Form Submission</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1F396D; margin-top: 0;">Contact Details</h3>
          <p><strong>Name:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${data.subject}</p>
        </div>
        <div style="background: #ffffff; padding: 20px; border-left: 4px solid #1F396D;">
          <h3 style="color: #1F396D; margin-top: 0;">Message</h3>
          <p style="white-space: pre-wrap;">${data.message}</p>
        </div>
        <div style="margin-top: 20px; padding: 15px; background: #e9ecef; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #6c757d;">
            Submitted on: ${new Date().toLocaleString()}<br>
            IP Address: ${data.ip || 'Unknown'}
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Generate text email for contact form submission
   */
  generateContactFormEmailText(data) {
    return `
New Contact Form Submission

Contact Details:
- Name: ${data.name}
- Email: ${data.email}
- Phone: ${data.phone || 'Not provided'}
- Subject: ${data.subject}

Message:
${data.message}

Submitted on: ${new Date().toLocaleString()}
IP Address: ${data.ip || 'Unknown'}
    `;
  }

  /**
   * Generate HTML confirmation email
   */
  generateConfirmationEmail(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1F396D;">Thank you for contacting GrowWise!</h2>
        <p>Dear ${data.name},</p>
        <p>Thank you for reaching out to us. We have received your message and will get back to you within 24 hours.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1F396D; margin-top: 0;">Your Message Summary</h3>
          <p><strong>Subject:</strong> ${data.subject}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 4px;">${data.message}</p>
        </div>

        <p>If you have any urgent questions, please don't hesitate to call us at <strong>+1 (555) 123-4567</strong>.</p>
        
        <div style="margin-top: 30px; padding: 20px; background: #1F396D; color: white; border-radius: 8px;">
          <h3 style="margin-top: 0; color: white;">What's Next?</h3>
          <ul style="margin: 0;">
            <li>Our team will review your inquiry</li>
            <li>We'll contact you within 24 hours</li>
            <li>We'll provide personalized guidance for your child's education</li>
          </ul>
        </div>

        <p style="margin-top: 20px;">Best regards,<br>The GrowWise Team</p>
      </div>
    `;
  }

  /**
   * Generate text confirmation email
   */
  generateConfirmationEmailText(data) {
    return `
Thank you for contacting GrowWise!

Dear ${data.name},

Thank you for reaching out to us. We have received your message and will get back to you within 24 hours.

Your Message Summary:
- Subject: ${data.subject}
- Message: ${data.message}

If you have any urgent questions, please don't hesitate to call us at +1 (555) 123-4567.

What's Next?
- Our team will review your inquiry
- We'll contact you within 24 hours  
- We'll provide personalized guidance for your child's education

Best regards,
The GrowWise Team
    `;
  }

  /**
   * Send WhatsApp notification (placeholder for future implementation)
   */
  async sendWhatsApp(data, type) {
    // TODO: Implement WhatsApp integration
    console.log('📱 WhatsApp notification would be sent:', { data, type });
    return { success: true, message: 'WhatsApp notification queued' };
  }

  /**
   * Send SMS notification (placeholder for future implementation)
   */
  async sendSMS(data, type) {
    // TODO: Implement SMS integration
    console.log('📱 SMS notification would be sent:', { data, type });
    return { success: true, message: 'SMS notification queued' };
  }

  /**
   * Get available channels
   */
  getAvailableChannels() {
    return Object.keys(this.channels);
  }

  /**
   * Get email strategy factory
   */
  getEmailStrategyFactory() {
    return this.emailStrategyFactory;
  }

  /**
   * Test email configuration using Strategy Pattern
   */
  async testEmailConnection() {
    try {
      const results = await this.emailStrategyFactory.testAllStrategies();
      return { success: true, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get configuration status
   */
  getConfigurationStatus() {
    return {
      channels: this.getAvailableChannels(),
      email: this.emailStrategyFactory.getConfigurationStatus()
    };
  }
}

module.exports = new NotificationService();