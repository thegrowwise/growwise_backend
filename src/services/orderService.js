const { getDatabase } = require('../database/database');
const logger = require('../utils/logger');

class OrderService {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Generate unique order ID
   */
  generateOrderId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Create a new order
   */
  async createOrder(orderData) {
    try {
      const orderId = this.generateOrderId();
      const now = new Date().toISOString();

      const order = {
        id: orderId,
        status: orderData.status || 'pending',
        createdAt: now,
        updatedAt: now,
        ...orderData,
      };

      const createdOrder = await this.db.createOrder(order);
      logger.info({ orderId }, 'Order created successfully');
      return createdOrder;
    } catch (error) {
      logger.error({ error: error.message }, 'Error creating order');
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status, additionalData = {}) {
    try {
      const updatedOrder = await this.db.updateOrderStatus(orderId, status, additionalData);
      logger.info({ orderId, status }, 'Order updated successfully');
      return updatedOrder;
    } catch (error) {
      logger.error({ error: error.message, orderId }, 'Error updating order');
      throw new Error(`Failed to update order: ${error.message}`);
    }
  }

  /**
   * Find order by Stripe session ID
   */
  async findOrderByStripeSessionId(stripeSessionId) {
    try {
      return await this.db.findOrderByStripeSessionId(stripeSessionId);
    } catch (error) {
      logger.error({ error: error.message, stripeSessionId }, 'Error finding order by session ID');
      return null;
    }
  }

  /**
   * Find a pending order by its items to prevent duplicate checkout sessions.
   */
  async findPendingOrderByItems(items, customerEmail) {
    try {
      return await this.db.findPendingOrderByItems(items, customerEmail);
    } catch (error) {
      logger.error({ error: error.message }, 'Error finding pending order by items');
      return null;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId) {
    try {
      return await this.db.getOrderById(orderId);
    } catch (error) {
      logger.error({ error: error.message, orderId }, 'Error getting order by ID');
      return null;
    }
  }

  /**
   * Get all orders (for admin purposes)
   */
  async getAllOrders(limit = 100, offset = 0) {
    try {
      return await this.db.getAllOrders(limit, offset);
    } catch (error) {
      logger.error({ error: error.message }, 'Error getting all orders');
      return { orders: [], total: 0, limit, offset };
    }
  }

  /**
   * Get orders by email
   */
  async getOrdersByEmail(email) {
    try {
      return await this.db.getOrdersByEmail(email);
    } catch (error) {
      logger.error({ error: error.message, email }, 'Error getting orders by email');
      return [];
    }
  }
}

module.exports = new OrderService();
