/**
 * Base Database Adapter
 * 
 * This abstract class defines the interface that all database adapters must implement.
 * To add support for a new database (MongoDB, PostgreSQL, MySQL, etc.), create a new
 * adapter class that extends this base class and implements all required methods.
 */
class BaseAdapter {
  constructor() {
    if (this.constructor === BaseAdapter) {
      throw new Error('BaseAdapter is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Initialize the database connection
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('connect() must be implemented by the adapter');
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by the adapter');
  }

  /**
   * Check if the adapter is connected
   * @returns {boolean}
   */
  isConnected() {
    throw new Error('isConnected() must be implemented by the adapter');
  }

  // ========== Order Methods ==========

  /**
   * Create a new order
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} Created order
   */
  async createOrder(orderData) {
    throw new Error('createOrder() must be implemented by the adapter');
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object|null>} Order or null if not found
   */
  async getOrderById(orderId) {
    throw new Error('getOrderById() must be implemented by the adapter');
  }

  /**
   * Update order status
   * @param {string} orderId - Order ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to update
   * @returns {Promise<Object>} Updated order
   */
  async updateOrderStatus(orderId, status, additionalData = {}) {
    throw new Error('updateOrderStatus() must be implemented by the adapter');
  }

  /**
   * Find order by Stripe session ID
   * @param {string} stripeSessionId - Stripe session ID
   * @returns {Promise<Object|null>} Order or null if not found
   */
  async findOrderByStripeSessionId(stripeSessionId) {
    throw new Error('findOrderByStripeSessionId() must be implemented by the adapter');
  }

  /**
   * Find pending order by items (for duplicate prevention)
   * @param {Array} items - Order items
   * @param {string} customerEmail - Customer email
   * @returns {Promise<Object|null>} Order or null if not found
   */
  async findPendingOrderByItems(items, customerEmail) {
    throw new Error('findPendingOrderByItems() must be implemented by the adapter');
  }

  /**
   * Get all orders with pagination
   * @param {number} limit - Number of orders to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Object>} { orders, total, limit, offset }
   */
  async getAllOrders(limit = 100, offset = 0) {
    throw new Error('getAllOrders() must be implemented by the adapter');
  }

  /**
   * Get orders by email
   * @param {string} email - Customer email
   * @returns {Promise<Array>} Array of orders
   */
  async getOrdersByEmail(email) {
    throw new Error('getOrdersByEmail() must be implemented by the adapter');
  }

  // ========== Contact Methods ==========

  /**
   * Create a new contact submission
   * @param {Object} contactData - Contact data
   * @returns {Promise<Object>} Created contact
   */
  async createContact(contactData) {
    throw new Error('createContact() must be implemented by the adapter');
  }

  /**
   * Get contact by ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<Object|null>} Contact or null if not found
   */
  async getContactById(contactId) {
    throw new Error('getContactById() must be implemented by the adapter');
  }

  /**
   * Get contact statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getContactStats() {
    throw new Error('getContactStats() must be implemented by the adapter');
  }

  // ========== Enrollment Methods ==========

  /**
   * Create a new enrollment
   * @param {Object} enrollmentData - Enrollment data
   * @returns {Promise<Object>} Created enrollment
   */
  async createEnrollment(enrollmentData) {
    throw new Error('createEnrollment() must be implemented by the adapter');
  }

  /**
   * Get enrollment by ID
   * @param {string} enrollmentId - Enrollment ID
   * @returns {Promise<Object|null>} Enrollment or null if not found
   */
  async getEnrollmentById(enrollmentId) {
    throw new Error('getEnrollmentById() must be implemented by the adapter');
  }

  /**
   * Update enrollment email status
   * @param {string} enrollmentId - Enrollment ID
   * @param {string} emailType - 'business' or 'user'
   * @param {boolean} sent - Whether email was sent
   * @param {string|null} emailId - Email message ID
   * @returns {Promise<Object>} Updated enrollment
   */
  async updateEnrollmentEmailStatus(enrollmentId, emailType, sent, emailId = null) {
    throw new Error('updateEnrollmentEmailStatus() must be implemented by the adapter');
  }
}

module.exports = BaseAdapter;

