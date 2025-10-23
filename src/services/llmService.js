/**
 * LLM Service for Backend
 * Provides LLM functionality for website search and other backend operations
 */

class LLMService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.baseUrl = 'https://api.openai.com/v1';
  }

  /**
   * Generate response using LLM
   */
  async generateResponse(messages) {
    if (!this.apiKey) {
      return {
        content: "I'm sorry, but the AI service is not configured. Please contact GrowWise directly for assistance.",
        error: 'API key not configured'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          max_tokens: 500,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        content: data.choices[0]?.message?.content || 'Sorry, I could not generate a response.',
      };
    } catch (error) {
      console.error('LLM API Error:', error);
      return {
        content: "I'm experiencing technical difficulties. Please try again or contact GrowWise directly for assistance.",
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if LLM service is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      model: this.model,
      hasApiKey: !!this.apiKey
    };
  }
}

module.exports = new LLMService();

