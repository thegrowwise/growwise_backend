const axios = require('axios');

/**
 * Website Search Service with LLM Integration
 * Provides intelligent search across the entire website content
 */
class WebsiteSearchService {
  constructor() {
    this.searchIndex = new Map();
    this.llmService = null;
    this.initializeIndex();
  }

  /**
   * Initialize search index with website content
   */
  initializeIndex() {
    // Course content
    this.addToIndex('courses', {
      title: 'K-12 Academic Programs',
      content: `
        Math Courses: Elementary Math, Middle School Math, DUSD Accelerated Math, High School Math (including Calculus)
        ELA Courses: English Mastery K-12, Reading Enrichment, Grammar Boost
        Writing Lab: Creative Writing, Essay Writing, Create & Reflect programs
        SAT/ACT Prep: Math Test Prep, Online SAT Test Prep, Online ACT Test Prep
      `,
      category: 'academic',
      url: '/academic'
    });

    this.addToIndex('steam', {
      title: 'STEAM Programs',
      content: `
        Game Development: Roblox Studio, Scratch visual programming, Minecraft coding
        Python Programming: Python Kickstart (beginner), Python Power Up (intermediate), Python Pro (advanced)
        Young Founders: Youth CEO leadership program, I Am Brand personal branding
        ML/Gen AI: Prompt Engineering, AI for Everyone, ML/AI for Highschoolers
      `,
      category: 'steam',
      url: '/steam'
    });

    this.addToIndex('about', {
      title: 'About GrowWise',
      content: `
        We serve 300+ students with 25+ courses
        98% student satisfaction rate
        Expert instructors with years of experience
        Personalized 1:1 attention and small group learning
        Serving Tri-Valley families with comprehensive K-12 academic programs
      `,
      category: 'about',
      url: '/about'
    });

    this.addToIndex('services', {
      title: 'Services',
      content: `
        FREE 60-minute assessment for K-12 programs
        FREE 30-minute trial class for STEAM courses
        Competitive pricing (contact for details)
        Expert instructors and proven results
        Personalized learning plans
      `,
      category: 'services',
      url: '/contact'
    });

    this.addToIndex('testimonials', {
      title: 'What Parents Say',
      content: `
        Sarah Johnson (Parent): "GrowWise transformed my daughter's approach to learning. She went from struggling with math to excelling in advanced courses."
        Michael Chen (Student): "The STEAM programs opened up a whole new world. I'm now pursuing computer science in college!"
        Lisa Rodriguez (Parent): "The personalized attention and innovative teaching methods make GrowWise stand out."
      `,
      category: 'testimonials',
      url: '/testimonials'
    });

    // Popular courses
    this.addToIndex('python', {
      title: 'Python Programming',
      content: 'Python Kickstart (beginner), Python Power Up (intermediate), Python Pro (advanced). Project-based learning with real-world applications.',
      category: 'steam',
      url: '/courses/python'
    });

    this.addToIndex('math', {
      title: 'Math Mastery',
      content: 'Elementary Math, Middle School Math, DUSD Accelerated Math, High School Math including Calculus. 1:1 attention and personalized learning.',
      category: 'academic',
      url: '/courses/math'
    });

    this.addToIndex('ai', {
      title: 'AI Explorer',
      content: 'Prompt Engineering, AI for Everyone, ML/AI for Highschoolers. Future-ready skills in artificial intelligence and machine learning.',
      category: 'steam',
      url: '/courses/ai'
    });

    this.addToIndex('reading', {
      title: 'Reading Mastery',
      content: 'English Mastery K-12, Reading Enrichment, Grammar Boost. Accelerated growth in reading and language skills.',
      category: 'academic',
      url: '/courses/reading'
    });
  }

  /**
   * Add content to search index
   */
  addToIndex(key, content) {
    this.searchIndex.set(key, {
      ...content,
      id: key,
      indexedAt: new Date().toISOString()
    });
  }

  /**
   * Set LLM service for intelligent search
   */
  setLLMService(llmService) {
    this.llmService = llmService;
  }

  /**
   * Search website content using LLM
   */
  async search(query, options = {}) {
    try {
      const { limit = 10, category = null, useLLM = true } = options;
      
      console.log(`🔍 Searching website for: "${query}"`);
      
      // Get all indexed content
      const allContent = Array.from(this.searchIndex.values());
      
      // Filter by category if specified
      const filteredContent = category 
        ? allContent.filter(item => item.category === category)
        : allContent;

      if (useLLM && this.llmService) {
        // Use LLM for intelligent search and ranking
        return await this.intelligentSearch(query, filteredContent, limit);
      } else {
        // Fallback to simple text search
        return this.simpleSearch(query, filteredContent, limit);
      }

    } catch (error) {
      console.error('❌ Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Intelligent search using LLM
   */
  async intelligentSearch(query, content, limit) {
    try {
      // Prepare content for LLM analysis
      const contentForLLM = content.map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category,
        url: item.url
      }));

      // Create LLM prompt for search
      const searchPrompt = `
        You are a search assistant for GrowWise educational platform. 
        Analyze the following content and rank it by relevance to the search query.
        
        Search Query: "${query}"
        
        Available Content:
        ${JSON.stringify(contentForLLM, null, 2)}
        
        Please return a JSON response with:
        1. rankedResults: Array of content items ranked by relevance (most relevant first)
        2. searchSummary: A brief summary of what was found
        3. suggestions: Array of related search suggestions
        
        Focus on educational content, courses, programs, and services that match the user's intent.
      `;

      // Call LLM service
      const llmResponse = await this.llmService.generateResponse([
        { role: 'user', content: searchPrompt }
      ]);

      // Parse LLM response
      let searchResults;
      try {
        const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          searchResults = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in LLM response');
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse LLM response, using fallback search');
        return this.simpleSearch(query, content, limit);
      }

      // Format results
      const results = searchResults.rankedResults?.slice(0, limit) || [];
      
      return {
        query,
        results: results.map(item => ({
          id: item.id,
          title: item.title,
          content: item.content,
          category: item.category,
          url: item.url,
          relevanceScore: item.relevanceScore || 0.8,
          matchedTerms: this.extractMatchedTerms(query, item.content)
        })),
        summary: searchResults.searchSummary || `Found ${results.length} results for "${query}"`,
        suggestions: searchResults.suggestions || [],
        totalResults: results.length,
        searchTime: Date.now(),
        method: 'llm'
      };

    } catch (error) {
      console.warn('⚠️ LLM search failed, using fallback:', error.message);
      return this.simpleSearch(query, content, limit);
    }
  }

  /**
   * Simple text-based search fallback
   */
  simpleSearch(query, content, limit) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const scoredResults = content.map(item => {
      const searchText = `${item.title} ${item.content}`.toLowerCase();
      let score = 0;
      
      // Calculate relevance score
      queryTerms.forEach(term => {
        if (searchText.includes(term)) {
          score += 1;
          // Boost score for title matches
          if (item.title.toLowerCase().includes(term)) {
            score += 0.5;
          }
        }
      });
      
      return {
        ...item,
        relevanceScore: score / queryTerms.length,
        matchedTerms: queryTerms.filter(term => searchText.includes(term))
      };
    });

    // Sort by relevance score
    const sortedResults = scoredResults
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return {
      query,
      results: sortedResults,
      summary: `Found ${sortedResults.length} results for "${query}"`,
      suggestions: this.generateSuggestions(query, content),
      totalResults: sortedResults.length,
      searchTime: Date.now(),
      method: 'simple'
    };
  }

  /**
   * Extract matched terms from content
   */
  extractMatchedTerms(query, content) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    return queryTerms.filter(term => contentLower.includes(term));
  }

  /**
   * Generate search suggestions
   */
  generateSuggestions(query, content) {
    const suggestions = [];
    const queryLower = query.toLowerCase();
    
    // Course-related suggestions
    if (queryLower.includes('math') || queryLower.includes('maths')) {
      suggestions.push('Math courses', 'Calculus', 'Algebra', 'SAT Math Prep');
    }
    
    if (queryLower.includes('programming') || queryLower.includes('coding')) {
      suggestions.push('Python Programming', 'Game Development', 'Scratch Programming');
    }
    
    if (queryLower.includes('ai') || queryLower.includes('artificial')) {
      suggestions.push('AI Explorer', 'Machine Learning', 'Prompt Engineering');
    }
    
    if (queryLower.includes('english') || queryLower.includes('reading')) {
      suggestions.push('English Mastery', 'Reading Enrichment', 'Writing Lab');
    }
    
    // General suggestions
    if (suggestions.length === 0) {
      suggestions.push('K-12 Programs', 'STEAM Courses', 'Free Assessment', 'Trial Classes');
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Get search statistics
   */
  getSearchStats() {
    return {
      totalIndexedItems: this.searchIndex.size,
      categories: [...new Set(Array.from(this.searchIndex.values()).map(item => item.category))],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Add dynamic content to search index
   */
  addDynamicContent(content) {
    this.addToIndex(`dynamic_${Date.now()}`, content);
  }

  /**
   * Update existing content in index
   */
  updateContent(key, content) {
    if (this.searchIndex.has(key)) {
      this.searchIndex.set(key, {
        ...this.searchIndex.get(key),
        ...content,
        updatedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Remove content from index
   */
  removeContent(key) {
    this.searchIndex.delete(key);
  }
}

module.exports = new WebsiteSearchService();

