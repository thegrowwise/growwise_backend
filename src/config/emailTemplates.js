/**
 * Configurable Email Templates for GrowWise
 * This file contains all email templates used across the application
 */

const emailTemplates = {
  // Business notification templates
  business: {
    enrollment: {
      subject: 'New Course Enrollment - {{studentName}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1F396D, #F16112); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">New Course Enrollment</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">GrowWise Educational Services</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #F16112;">
              <h2 style="color: #1F396D; margin-top: 0;">Student Information</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Name:</td><td style="padding: 8px 0; color: #666;">{{studentName}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Email:</td><td style="padding: 8px 0; color: #666;">{{studentEmail}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Mobile:</td><td style="padding: 8px 0; color: #666;">{{studentPhone}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Location:</td><td style="padding: 8px 0; color: #666;">{{location}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Level:</td><td style="padding: 8px 0; color: #666;">{{level}}</td></tr>
              </table>
            </div>

            <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1F396D;">
              <h2 style="color: #1F396D; margin-top: 0;">Course Selection</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Bootcamp:</td><td style="padding: 8px 0; color: #666;">{{bootcamp}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Course:</td><td style="padding: 8px 0; color: #666;">{{course}}</td></tr>
              </table>
            </div>

            <div style="background: #e8f4f8; padding: 25px; border-radius: 8px; border: 1px solid #1F396D;">
              <h2 style="color: #1F396D; margin-top: 0;">Next Steps</h2>
              <ul style="color: #333; line-height: 1.6;">
                <li>Contact the student within 24 hours</li>
                <li>Send course materials and schedule</li>
                <li>Schedule placement assessment if needed</li>
                <li>Add to student management system</li>
                <li>Send welcome package</li>
              </ul>
            </div>
          </div>

          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              Submitted: {{timestamp}}<br>
              IP Address: {{ipAddress}}
            </p>
          </div>
        </div>
      `,
      text: `
NEW COURSE ENROLLMENT - GROWWISE

Student Information:
- Name: {{studentName}}
- Email: {{studentEmail}}
- Mobile: {{studentPhone}}
- Location: {{location}}
- Level: {{level}}

Course Selection:
- Bootcamp: {{bootcamp}}
- Course: {{course}}

Next Steps:
- Contact the student within 24 hours
- Send course materials and schedule
- Schedule placement assessment if needed
- Add to student management system
- Send welcome package

Submitted: {{timestamp}}
IP Address: {{ipAddress}}
      `
    },
    contact: {
      subject: 'New Contact Form Submission - {{name}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1F396D;">New Contact Form Submission</h2>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1F396D; margin-top: 0;">Contact Details</h3>
            <p><strong>Name:</strong> {{name}}</p>
            <p><strong>Email:</strong> {{email}}</p>
            <p><strong>Phone:</strong> {{phone}}</p>
            <p><strong>Subject:</strong> {{subject}}</p>
          </div>
          <div style="background: #ffffff; padding: 20px; border-left: 4px solid #1F396D;">
            <h3 style="color: #1F396D; margin-top: 0;">Message</h3>
            <p style="white-space: pre-wrap;">{{message}}</p>
          </div>
        </div>
      `,
      text: `
New Contact Form Submission

Contact Details:
- Name: {{name}}
- Email: {{email}}
- Phone: {{phone}}
- Subject: {{subject}}

Message:
{{message}}
      `
    }
  },

  // User confirmation templates
  user: {
    enrollment: {
      subject: 'Welcome to GrowWise - Enrollment Confirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1F396D, #F16112); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to GrowWise!</h1>
            <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Thank you for enrolling with us</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #F16112;">
              <h2 style="color: #1F396D; margin-top: 0;">Your Enrollment Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Name:</td><td style="padding: 8px 0; color: #666;">{{studentName}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Email:</td><td style="padding: 8px 0; color: #666;">{{studentEmail}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Level:</td><td style="padding: 8px 0; color: #666;">{{level}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Bootcamp:</td><td style="padding: 8px 0; color: #666;">{{bootcamp}}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Course:</td><td style="padding: 8px 0; color: #666;">{{course}}</td></tr>
              </table>
            </div>

            <div style="background: #e8f4f8; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1F396D; margin-top: 0;">What Happens Next?</h2>
              <ul style="color: #333; line-height: 1.6;">
                <li>Our team will contact you within 24 hours</li>
                <li>We'll send you detailed course information</li>
                <li>We'll schedule your placement assessment</li>
                <li>You'll receive your welcome package</li>
                <li>We'll set up your learning account</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://growwise.com" style="background: linear-gradient(135deg, #1F396D, #F16112); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                Visit Our Website
              </a>
            </div>
          </div>

          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              This email was sent from GrowWise Educational Services<br>
              If you have any questions, please contact us at info@growwise.com
            </p>
          </div>
        </div>
      `,
      text: `
WELCOME TO GROWWISE!

Thank you for enrolling with us.

Your Enrollment Details:
- Name: {{studentName}}
- Email: {{studentEmail}}
- Level: {{level}}
- Bootcamp: {{bootcamp}}
- Course: {{course}}

What Happens Next?
- Our team will contact you within 24 hours
- We'll send you detailed course information
- We'll schedule your placement assessment
- You'll receive your welcome package
- We'll set up your learning account

Visit our website: https://growwise.com

If you have any questions, please contact us at info@growwise.com
      `
    },
    contact: {
      subject: 'Thank you for contacting GrowWise!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1F396D;">Thank you for contacting us!</h2>
          <p>We have received your message and will get back to you within 24 hours.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1F396D; margin-top: 0;">Your Message</h3>
            <p style="white-space: pre-wrap;">{{message}}</p>
          </div>
        </div>
      `,
      text: `
Thank you for contacting us!

We have received your message and will get back to you within 24 hours.

Your Message:
{{message}}
      `
    }
  }
};

/**
 * Template processor function
 * @param {string} template - Template string with placeholders
 * @param {Object} data - Data object to replace placeholders
 * @returns {string} - Processed template
 */
function processTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
}

/**
 * Get email template
 * @param {string} type - Template type (business/user)
 * @param {string} category - Template category (enrollment/contact)
 * @param {Object} data - Data to process template with
 * @returns {Object} - Processed email template
 */
function getEmailTemplate(type, category, data = {}) {
  const template = emailTemplates[type]?.[category];
  if (!template) {
    throw new Error(`Template not found: ${type}.${category}`);
  }

  return {
    subject: processTemplate(template.subject, data),
    html: processTemplate(template.html, data),
    text: processTemplate(template.text, data)
  };
}

module.exports = {
  emailTemplates,
  processTemplate,
  getEmailTemplate
};
