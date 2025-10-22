const nodemailer = require('nodemailer');

/**
 * Secure Email Service - Uses system environment variables
 * No passwords in .env files
 */
class SecureEmailService {
  constructor() {
    this.transporter = null;
  }

  /**
   * Initialize email service with secure credentials
   */
  async initialize() {
    try {
      // Get credentials from system environment or secure vault
      const emailConfig = this.getSecureEmailConfig();
      
      if (!emailConfig) {
        throw new Error('Email configuration not found');
      }

      this.transporter = nodemailer.createTransporter(emailConfig);
      
      // Test connection
      await this.transporter.verify();
      console.log('✅ Secure Email Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Secure Email Service initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Get secure email configuration
   * Priority: System env > Docker secrets > Vault > .env
   */
  getSecureEmailConfig() {
    // Method 1: System Environment Variables
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      return {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };
    }

    // Method 2: Docker Secrets (if running in Docker)
    if (process.env.SMTP_PASS_FILE) {
      const fs = require('fs');
      try {
        const password = fs.readFileSync(process.env.SMTP_PASS_FILE, 'utf8').trim();
        return {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: password
          }
        };
      } catch (error) {
        console.error('❌ Failed to read password from file:', error.message);
      }
    }

    // Method 3: AWS Secrets Manager (if available)
    if (process.env.AWS_REGION && process.env.SMTP_SECRET_NAME) {
      return this.getAwsSecrets();
    }

    // Method 4: Azure Key Vault (if available)
    if (process.env.AZURE_KEY_VAULT_URL && process.env.SMTP_SECRET_NAME) {
      return this.getAzureSecrets();
    }

    return null;
  }

  /**
   * Get credentials from AWS Secrets Manager
   */
  async getAwsSecrets() {
    try {
      const AWS = require('aws-sdk');
      const secretsManager = new AWS.SecretsManager({
        region: process.env.AWS_REGION
      });

      const result = await secretsManager.getSecretValue({
        SecretId: process.env.SMTP_SECRET_NAME
      }).promise();

      const secret = JSON.parse(result.SecretString);
      return {
        host: secret.SMTP_HOST,
        port: secret.SMTP_PORT,
        secure: secret.SMTP_SECURE === 'true',
        auth: {
          user: secret.SMTP_USER,
          pass: secret.SMTP_PASS
        }
      };
    } catch (error) {
      console.error('❌ AWS Secrets Manager failed:', error.message);
      return null;
    }
  }

  /**
   * Get credentials from Azure Key Vault
   */
  async getAzureSecrets() {
    try {
      const { DefaultAzureCredential } = require('@azure/identity');
      const { SecretClient } = require('@azure/keyvault-secrets');

      const credential = new DefaultAzureCredential();
      const client = new SecretClient(process.env.AZURE_KEY_VAULT_URL, credential);

      const [smtpHost, smtpUser, smtpPass] = await Promise.all([
        client.getSecret(process.env.SMTP_SECRET_NAME + '-host'),
        client.getSecret(process.env.SMTP_SECRET_NAME + '-user'),
        client.getSecret(process.env.SMTP_SECRET_NAME + '-pass')
      ]);

      return {
        host: smtpHost.value,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser.value,
          pass: smtpPass.value
        }
      };
    } catch (error) {
      console.error('❌ Azure Key Vault failed:', error.message);
      return null;
    }
  }

  /**
   * Send email
   */
  async sendEmail(emailConfig) {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      const result = await this.transporter.sendMail(emailConfig);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Secure email sending failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      await this.transporter.verify();
      return { success: true, message: 'Secure connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SecureEmailService();
