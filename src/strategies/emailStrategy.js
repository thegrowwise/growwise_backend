/**
 * Email Strategy Interface
 * All email strategies must implement this interface
 */
class EmailStrategy {
  async sendEmail(emailConfig) {
    throw new Error('sendEmail method must be implemented');
  }

  async testConnection() {
    throw new Error('testConnection method must be implemented');
  }

  isConfigured() {
    throw new Error('isConfigured method must be implemented');
  }
}

module.exports = EmailStrategy;
