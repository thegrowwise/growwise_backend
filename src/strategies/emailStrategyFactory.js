const SmtpStrategy = require('./smtpStrategy');
const SendGridStrategy = require('./sendgridStrategy');

/**
 * Email Strategy Factory
 * Creates and manages email strategies based on configuration
 */
class EmailStrategyFactory {
  constructor() {
    this.strategies = [];
    this.initializeStrategies();
  }

  /**
   * Initialize available strategies
   */
  initializeStrategies() {
    // Add SendGrid strategy (highest priority)
    if (this.isSendGridConfigured()) {
      this.strategies.push(new SendGridStrategy());
    }

    // Add SMTP strategy (fallback)
    if (this.isSmtpConfigured()) {
      this.strategies.push(new SmtpStrategy());
    }
  }

  /**
   * Check if SendGrid is configured
   */
  isSendGridConfigured() {
    return !!(
      process.env.SENDGRID_API_KEY &&
      process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key-here' &&
      process.env.FROM_EMAIL
    );
  }

  /**
   * Check if SMTP is configured
   */
  isSmtpConfigured() {
    return !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );
  }

  /**
   * Get available strategies
   */
  getAvailableStrategies() {
    return this.strategies.map(strategy => ({
      name: strategy.getStrategyName(),
      configured: strategy.isConfigured()
    }));
  }

  /**
   * Get the best available strategy
   */
  getBestStrategy() {
    if (this.strategies.length === 0) {
      throw new Error('No email strategies configured');
    }

    // Return the first available strategy (priority order)
    return this.strategies[0];
  }

  /**
   * Get strategy by name
   */
  getStrategyByName(name) {
    return this.strategies.find(strategy => 
      strategy.getStrategyName().toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Send email using the best available strategy
   */
  async sendEmail(emailConfig) {
    const strategy = this.getBestStrategy();
    
    try {
      return await strategy.sendEmail(emailConfig);
    } catch (error) {
      // Try fallback strategies if the primary fails
      for (let i = 1; i < this.strategies.length; i++) {
        try {
          console.warn(`⚠️ ${strategy.getStrategyName()} failed, trying ${this.strategies[i].getStrategyName()}:`, error.message);
          return await this.strategies[i].sendEmail(emailConfig);
        } catch (fallbackError) {
          console.warn(`⚠️ ${this.strategies[i].getStrategyName()} also failed:`, fallbackError.message);
        }
      }
      
      throw new Error(`All email strategies failed. Last error: ${error.message}`);
    }
  }

  /**
   * Test all configured strategies
   */
  async testAllStrategies() {
    const results = [];
    
    for (const strategy of this.strategies) {
      try {
        const result = await strategy.testConnection();
        results.push({
          strategy: strategy.getStrategyName(),
          success: true,
          message: result.message
        });
      } catch (error) {
        results.push({
          strategy: strategy.getStrategyName(),
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Get configuration status
   */
  getConfigurationStatus() {
    return {
      sendgrid: {
        configured: this.isSendGridConfigured(),
        hasApiKey: !!process.env.SENDGRID_API_KEY,
        hasFromEmail: !!process.env.FROM_EMAIL
      },
      smtp: {
        configured: this.isSmtpConfigured(),
        hasHost: !!process.env.SMTP_HOST,
        hasUser: !!process.env.SMTP_USER,
        hasPassword: !!process.env.SMTP_PASS
      },
      availableStrategies: this.getAvailableStrategies()
    };
  }
}

module.exports = EmailStrategyFactory;

