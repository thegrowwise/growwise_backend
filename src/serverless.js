/**
 * Serverless wrapper for AWS Lambda
 * This file wraps the Express app for AWS Lambda + API Gateway
 */

const serverless = require('serverless-http');
const app = require('./server');

// Export the handler for AWS Lambda
module.exports.handler = serverless(app, {
  binary: ['image/*', 'application/pdf'],
});


