const express = require('express');
const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const orderService = require('../services/orderService');
const logger = require('../utils/logger');

// Middleware to check if Stripe is configured
const checkStripeConfig = (req, res, next) => {
  if (!stripe) {
    return res.status(500).json({ 
      error: 'Stripe is not configured',
      message: 'Please set STRIPE_SECRET_KEY environment variable'
    });
  }
  next();
};

// Create checkout session
router.post('/create-checkout-session', checkStripeConfig, async (req, res) => {
  try {
    logger.info('Creating checkout session');
    logger.debug({ body: req.body }, 'Checkout session request body');
    const { items, customerEmail, customerName, locale = 'en' } = req.body;
    logger.debug({ itemsCount: items?.length, locale, hasEmail: !!customerEmail }, 'Parsed checkout data');

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required and cannot be empty' });
    }

    // Validate items structure
    for (const item of items) {
      if (!item.id || !item.name || typeof item.price !== 'number' || !item.quantity) {
        return res.status(400).json({ error: 'Each item must have id, name, price, and quantity' });
      }
    }

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity * 100), 0); // Convert to cents

    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Total amount must be greater than 0' });
    }

    // Check if there's already a pending order with the same items (prevent duplicate orders)
    // This is a simple check - in production, you might want more sophisticated duplicate detection
    const existingOrders = await orderService.getOrdersByEmail(customerEmail || '');
    const recentPendingOrder = existingOrders.find(o => 
      o.status === 'pending' && 
      o.items.length === items.length &&
      JSON.stringify(o.items.map(i => ({ id: i.id, quantity: i.quantity }))) === 
      JSON.stringify(items.map(i => ({ id: i.id, quantity: i.quantity }))) &&
      new Date(o.createdAt) > new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
    );
    
    let order;
    if (recentPendingOrder && recentPendingOrder.stripeSessionId) {
      // If there's a recent pending order with a Stripe session, return that session
      logger.warn({ orderId: recentPendingOrder.id, sessionId: recentPendingOrder.stripeSessionId }, 'Found existing pending order with session');
      logger.info('Returning existing session to prevent duplicate payment');
      
      // Retrieve the session from Stripe to get the URL
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(recentPendingOrder.stripeSessionId);
        if (existingSession.status === 'open') {
          return res.json({
            sessionId: existingSession.id,
            orderId: recentPendingOrder.id,
            url: existingSession.url,
            warning: 'Using existing checkout session'
          });
        }
      } catch (err) {
        logger.info('Existing session not found or expired, creating new order');
      }
    }
    
    // Create order in database BEFORE creating Stripe session
    // This ensures we have a record even if payment fails
    try {
      logger.info('Creating order in database');
      order = await orderService.createOrder({
        items: items,
        customerEmail: customerEmail,
        customerName: customerName,
        locale: locale,
        totalAmount: totalAmount / 100, // Convert back to dollars
        status: 'pending',
      });
      logger.info({ orderId: order.id }, 'Order created successfully');
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error creating order');
      return res.status(500).json({ 
        error: 'Failed to create order',
        message: error.message 
      });
    }

    // Create line items for Stripe
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.description || `${item.category || 'Course'} - ${item.level || ''}`.trim(),
          images: item.image ? [item.image] : undefined,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Determine success and cancel URLs based on locale
    // Default to port 3000, but can be overridden via FRONTEND_URL env var
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/${locale}/cart`;
    
    // Log the URLs for debugging
    logger.debug({ successUrl, cancelUrl, baseUrl }, 'Checkout URLs configured');

    // Prepare metadata (Stripe has 500 character limit per metadata value)
    // Store only essential info - full items are already in line_items
    const itemIds = items.map(item => item.id).join(',');
    const itemNames = items.map(item => item.name).join('; ');
    
    // Truncate if necessary to stay within limits
    const metadata = {
      orderId: order.id, // Store order ID for webhook lookup
      locale: locale || 'en',
      itemCount: items.length.toString(),
      totalAmount: (items.reduce((sum, item) => sum + (item.price * item.quantity), 0)).toString(),
    };
    
    // Add customer name if provided (truncate to 200 chars to leave room)
    if (customerName) {
      metadata.customerName = customerName.substring(0, 200);
    }
    
    // Add item IDs (truncate if too long, but try to keep all)
    if (itemIds.length <= 200) {
      metadata.itemIds = itemIds;
    } else {
      // If too long, just store count and first few IDs
      metadata.itemIds = itemIds.substring(0, 197) + '...';
    }
    
    // Add first item name as reference (truncate if needed)
    if (itemNames.length > 0) {
      metadata.firstItem = itemNames.substring(0, 200);
    }

    // Create Stripe checkout session
    let session;
    try {
      logger.info('Creating Stripe checkout session');
      logger.debug({ lineItems }, 'Stripe line items');
      
      // Generate idempotency key to prevent duplicate session creation
      // Use order ID as part of the key to ensure uniqueness per order
      const idempotencyKey = `checkout_${order.id}_${Date.now()}`;
      
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        metadata: metadata,
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN'], // Add more countries as needed
        },
        automatic_tax: {
          enabled: true,
        },
        allow_promotion_codes: true,
        // Ensure redirect happens after payment
        payment_intent_data: {
          metadata: metadata,
        },
      }, {
        idempotencyKey: idempotencyKey, // Prevent duplicate session creation
      });
      
      logger.info({ sessionId: session.id, url: session.url }, 'Stripe session created successfully');

      // Update order with Stripe session ID (non-blocking - don't wait for it)
      // This ensures the response is sent immediately so Stripe can redirect
      orderService.updateOrderStatus(order.id, 'pending', {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || null,
      }).then(() => {
        logger.info({ orderId: order.id, sessionId: session.id }, 'Order updated with Stripe session ID');
      }).catch((updateError) => {
        logger.warn({ error: updateError.message, orderId: order.id }, 'Failed to update order with Stripe session ID');
        // Don't fail the request if order update fails - the order was already created
      });
    } catch (stripeError) {
      logger.error({ error: stripeError.message, stack: stripeError.stack, orderId: order.id }, 'Stripe error creating checkout session');
      // If Stripe session creation fails, mark order as failed
      try {
        await orderService.updateOrderStatus(order.id, 'failed', {
          error: stripeError.message,
        });
      } catch (updateError) {
        logger.error({ error: updateError.message, orderId: order.id }, 'Error updating order status to failed');
      }
      throw stripeError;
    }

    logger.info({ sessionId: session.id, orderId: order.id }, 'Checkout session created successfully');
    
    // Send response immediately - don't wait for order update
    if (!res.headersSent) {
      res.json({ 
        sessionId: session.id,
        orderId: order.id,
        url: session.url 
      });
      logger.debug('Response sent to frontend');
    } else {
      logger.warn('Response already sent, cannot send checkout session response');
    }
  } catch (error) {
    logger.error({ 
      error: error.message, 
      name: error.name, 
      stack: error.stack 
    }, 'Error creating checkout session');
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to create checkout session',
        message: error.message || 'Unknown error occurred'
      });
    } else {
      logger.error('Cannot send error response - headers already sent');
    }
  }
});

// Retrieve checkout session (for success page)
router.get('/session/:sessionId', checkStripeConfig, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer', 'payment_intent'],
    });

    res.json({ session });
  } catch (error) {
    logger.error({ error: error.message, sessionId }, 'Error retrieving session');
    res.status(500).json({ 
      error: 'Failed to retrieve session',
      message: error.message 
    });
  }
});

// Get order by ID
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const order = await orderService.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    logger.error({ error: error.message, orderId }, 'Error retrieving order');
    res.status(500).json({ 
      error: 'Failed to retrieve order',
      message: error.message 
    });
  }
});

// Get orders by email
router.get('/orders/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const orders = await orderService.getOrdersByEmail(email);
    res.json({ orders });
  } catch (error) {
    logger.error({ error: error.message, email }, 'Error retrieving orders by email');
    res.status(500).json({ 
      error: 'Failed to retrieve orders',
      message: error.message 
    });
  }
});

// Note: Webhook endpoint is handled in server.js before body parsing middleware

module.exports = router;

