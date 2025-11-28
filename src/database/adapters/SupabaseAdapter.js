const BaseAdapter = require('./BaseAdapter');
const supabase = require('../../services/supabaseClient');
const logger = require('../../utils/logger');

/**
 * Supabase Database Adapter
 * 
 * Implements the BaseAdapter interface for Supabase PostgreSQL database.
 */
class SupabaseAdapter extends BaseAdapter {
  constructor() {
    super();
    this.client = supabase;
    this.connected = !!supabase;
    
    // Auto-connect if client is available
    if (this.client) {
      this.connect().catch(error => {
        logger.error({ error: error.message }, 'Failed to auto-connect Supabase adapter');
      });
    } else {
      logger.warn('Supabase client not initialized. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
  }

  async connect() {
    if (!this.client) {
      throw new Error('Supabase client is not initialized. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
    this.connected = true;
    logger.info('Supabase adapter connected');
  }

  async disconnect() {
    // Supabase client doesn't require explicit disconnection
    this.connected = false;
    logger.info('Supabase adapter disconnected');
  }

  isConnected() {
    return this.connected && !!this.client;
  }

  // ========== Order Methods ==========

  async createOrder(orderData) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error } = await this.client
      .from('orders')
      .insert([
        {
          id: orderData.id,
          status: orderData.status || 'pending',
          items: orderData.items,
          customer_email: orderData.customerEmail,
          customer_name: orderData.customerName,
          locale: orderData.locale || 'en',
          total_amount: orderData.totalAmount,
          processing_fee: orderData.processingFee || 0,
          created_at: orderData.createdAt || new Date().toISOString(),
          updated_at: orderData.updatedAt || new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message, orderId: orderData.id }, 'Supabase error creating order');
      throw new Error(`Failed to create order: ${error.message}`);
    }

    return this.mapSupabaseOrderToOrder(data);
  }

  async getOrderById(orderId) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      // Try finding by Stripe session ID
      return await this.findOrderByStripeSessionId(orderId);
    }

    return this.mapSupabaseOrderToOrder(data);
  }

  async updateOrderStatus(orderId, status, additionalData = {}) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    // Check if order is already in the target status (idempotency)
    const existingOrder = await this.getOrderById(orderId);
    if (existingOrder && existingOrder.status === status && status === 'paid') {
      logger.warn({ orderId }, 'Order already in paid status. Skipping update.');
      return existingOrder;
    }

    const updateData = {
      status: status,
      updated_at: new Date().toISOString(),
    };

    // Map additional data to Supabase columns
    if (additionalData.stripeSessionId) updateData.stripe_session_id = additionalData.stripeSessionId;
    if (additionalData.stripePaymentIntentId) updateData.stripe_payment_intent_id = additionalData.stripePaymentIntentId;
    if (additionalData.stripeSessionUrl) updateData.stripe_session_url = additionalData.stripeSessionUrl;
    if (additionalData.paidAt) updateData.paid_at = additionalData.paidAt;
    if (additionalData.failedAt) updateData.failed_at = additionalData.failedAt;
    if (additionalData.error) updateData.error_message = additionalData.error;
    if (additionalData.amountPaid !== undefined) updateData.amount_paid = additionalData.amountPaid;
    if (additionalData.currency) updateData.currency = additionalData.currency;
    if (additionalData.customerEmail) updateData.customer_email = additionalData.customerEmail;
    if (additionalData.customerName) updateData.customer_name = additionalData.customerName;
    if (additionalData.customerPhone) updateData.customer_phone = additionalData.customerPhone;
    if (additionalData.shippingName) updateData.shipping_name = additionalData.shippingName;
    if (additionalData.shippingLine1) updateData.shipping_line1 = additionalData.shippingLine1;
    if (additionalData.shippingLine2) updateData.shipping_line2 = additionalData.shippingLine2;
    if (additionalData.shippingCity) updateData.shipping_city = additionalData.shippingCity;
    if (additionalData.shippingState) updateData.shipping_state = additionalData.shippingState;
    if (additionalData.shippingPostalCode) updateData.shipping_postal_code = additionalData.shippingPostalCode;
    if (additionalData.shippingCountry) updateData.shipping_country = additionalData.shippingCountry;
    if (additionalData.taxAmount !== undefined) updateData.tax_amount = additionalData.taxAmount;
    if (additionalData.taxRate !== undefined) updateData.tax_rate = additionalData.taxRate;
    if (additionalData.taxId) updateData.tax_id = additionalData.taxId;
    if (additionalData.processingFee !== undefined) updateData.processing_fee = additionalData.processingFee;
    if (additionalData.metadata) updateData.metadata = additionalData.metadata;

    const { data, error } = await this.client
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message, orderId }, 'Supabase update error for order');
      throw new Error(`Failed to update order: ${error.message}`);
    }

    return this.mapSupabaseOrderToOrder(data);
  }

  async findOrderByStripeSessionId(stripeSessionId) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('stripe_session_id', stripeSessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapSupabaseOrderToOrder(data);
  }

  async findPendingOrderByItems(items, customerEmail) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const itemIds = items.map(item => item.id).sort().join(',');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let query = this.client
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', fiveMinutesAgo);

    if (customerEmail) {
      query = query.eq('customer_email', customerEmail);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error: error.message }, 'Supabase error finding pending order by items');
      return null;
    }

    // Manually filter by items (JSONB comparison is tricky)
    const matchingOrder = data.find(order => {
      const orderItemIds = order.items.map(item => item.id).sort().join(',');
      return orderItemIds === itemIds;
    });

    return matchingOrder ? this.mapSupabaseOrderToOrder(matchingOrder) : null;
  }

  async getAllOrders(limit = 100, offset = 0) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error, count } = await this.client
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      orders: data.map(order => this.mapSupabaseOrderToOrder(order)),
      total: count || 0,
      limit,
      offset,
    };
  }

  async getOrdersByEmail(email) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('customer_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(order => this.mapSupabaseOrderToOrder(order));
  }

  // ========== Contact Methods ==========

  async createContact(contactData) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error } = await this.client
      .from('contacts')
      .insert([
        {
          id: contactData.id,
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone || null,
          subject: contactData.subject,
          message: contactData.message,
          ip: contactData.ip,
          user_agent: contactData.userAgent,
          referrer: contactData.referrer,
          status: 'new',
          created_at: contactData.submittedAt || new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message, contactId: contactData.id }, 'Supabase error creating contact');
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return data;
  }

  async getContactById(contactId) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error } = await this.client
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  async getContactStats() {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
    const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString();

    const { count: totalCount } = await this.client
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    const { count: todayCount } = await this.client
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    const { count: weekCount } = await this.client
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo);

    const { count: monthCount } = await this.client
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthAgo);

    return {
      totalSubmissions: totalCount || 0,
      todaySubmissions: todayCount || 0,
      thisWeekSubmissions: weekCount || 0,
      thisMonthSubmissions: monthCount || 0
    };
  }

  // ========== Enrollment Methods ==========

  async createEnrollment(enrollmentData) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error } = await this.client
      .from('enrollments')
      .insert([
        {
          id: enrollmentData.id,
          full_name: enrollmentData.fullName,
          email: enrollmentData.email,
          mobile: enrollmentData.mobile,
          city: enrollmentData.city,
          postal: enrollmentData.postal,
          bootcamp: enrollmentData.bootcamp || null,
          course: enrollmentData.course || null,
          level: enrollmentData.level,
          agree: enrollmentData.agree || false,
          ip: enrollmentData.ip,
          user_agent: enrollmentData.userAgent || null,
          referrer: enrollmentData.referrer || null,
          status: 'pending',
          created_at: enrollmentData.timestamp || new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message, enrollmentId: enrollmentData.id }, 'Supabase error creating enrollment');
      throw new Error(`Failed to create enrollment: ${error.message}`);
    }

    return data;
  }

  async getEnrollmentById(enrollmentId) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const { data, error } = await this.client
      .from('enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  async updateEnrollmentEmailStatus(enrollmentId, emailType, sent, emailId = null) {
    if (!this.isConnected()) {
      throw new Error('Database adapter is not connected');
    }

    const updateData = {};
    if (emailType === 'business') {
      updateData.business_email_sent = sent;
      if (emailId) updateData.business_email_id = emailId;
    } else if (emailType === 'user') {
      updateData.user_email_sent = sent;
      if (emailId) updateData.user_email_id = emailId;
    }

    const { error } = await this.client
      .from('enrollments')
      .update(updateData)
      .eq('id', enrollmentId);

    if (error) {
      logger.error({ error: error.message, enrollmentId }, 'Error updating enrollment email status');
      throw new Error(`Failed to update enrollment email status: ${error.message}`);
    }

    return await this.getEnrollmentById(enrollmentId);
  }

  // ========== Helper Methods ==========

  mapSupabaseOrderToOrder(supabaseOrder) {
    if (!supabaseOrder) return null;

    return {
      id: supabaseOrder.id,
      status: supabaseOrder.status,
      items: supabaseOrder.items,
      customerEmail: supabaseOrder.customer_email,
      customerName: supabaseOrder.customer_name,
      customerPhone: supabaseOrder.customer_phone,
      locale: supabaseOrder.locale,
      totalAmount: parseFloat(supabaseOrder.total_amount),
      currency: supabaseOrder.currency,
      amountPaid: supabaseOrder.amount_paid ? parseFloat(supabaseOrder.amount_paid) : null,
      stripeSessionId: supabaseOrder.stripe_session_id,
      stripePaymentIntentId: supabaseOrder.stripe_payment_intent_id,
      stripeSessionUrl: supabaseOrder.stripe_session_url,
      paidAt: supabaseOrder.paid_at,
      failedAt: supabaseOrder.failed_at,
      errorMessage: supabaseOrder.error_message,
      shippingName: supabaseOrder.shipping_name,
      shippingLine1: supabaseOrder.shipping_line1,
      shippingLine2: supabaseOrder.shipping_line2,
      shippingCity: supabaseOrder.shipping_city,
      shippingState: supabaseOrder.shipping_state,
      shippingPostalCode: supabaseOrder.shipping_postal_code,
      shippingCountry: supabaseOrder.shipping_country,
      taxAmount: supabaseOrder.tax_amount ? parseFloat(supabaseOrder.tax_amount) : null,
      taxRate: supabaseOrder.tax_rate ? parseFloat(supabaseOrder.tax_rate) : null,
      taxId: supabaseOrder.tax_id,
      processingFee: supabaseOrder.processing_fee ? parseFloat(supabaseOrder.processing_fee) : null,
      metadata: supabaseOrder.metadata,
      createdAt: supabaseOrder.created_at,
      updatedAt: supabaseOrder.updated_at,
    };
  }
}

module.exports = SupabaseAdapter;

