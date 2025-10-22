const sgMail = require('@sendgrid/mail');

/**
 * SendGrid Email Service - No SMTP passwords needed!
 * Uses API keys instead of SMTP
 */
class SendGridService {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@thegrowwise.com';
    this.fromName = process.env.FROM_NAME || 'GrowWise';
  }

  /**
   * Initialize SendGrid
   */
  async initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('SENDGRID_API_KEY not found in environment variables');
      }

      sgMail.setApiKey(this.apiKey);
      console.log('✅ SendGrid service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ SendGrid initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Send contact form notification
   */
  async sendContactNotification(data) {
    try {
      const msg = {
        to: process.env.CONTACT_EMAILS?.split(',') || ['thegrowwise@gmail.com'],
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: `New Contact Form Submission - ${data.name}`,
        html: this.generateContactFormEmail(data),
        text: this.generateContactFormEmailText(data)
      };
      console.log('🌐 Email data:', msg);
      console.log('🌐 Email data:', this.fromEmail, this.fromName);

      const result = await sgMail.send(msg);
      console.log('🌐 Email result:', result);
      return { success: true, messageId: result[0].headers['x-message-id'] };
    } catch (error) {
      console.error('❌ SendGrid contact notification failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send confirmation email
   */
  async sendConfirmationEmail(data) {
    try {
      const msg = {
        to: data.email,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: 'Thank you for contacting GrowWise!',
        html: this.generateConfirmationEmail(data),
        text: this.generateConfirmationEmailText(data)
      };

      const result = await sgMail.send(msg);
      return { success: true, messageId: result[0].headers['x-message-id'] };
    } catch (error) {
      console.error('❌ SendGrid confirmation email failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate contact form email HTML
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
   * Generate contact form email text
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
   * Generate confirmation email HTML
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
   * Generate confirmation email text
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
   * Test SendGrid connection
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        return { success: false, error: 'SENDGRID_API_KEY not found' };
      }

      sgMail.setApiKey(this.apiKey);
      
      // Send a test email to yourself
      const msg = {
        to: this.fromEmail,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: 'SendGrid Test Email',
        text: 'This is a test email to verify SendGrid configuration.',
        html: '<p>This is a test email to verify SendGrid configuration.</p>'
      };

      await sgMail.send(msg);
      return { success: true, message: 'SendGrid test email sent successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SendGridService();
