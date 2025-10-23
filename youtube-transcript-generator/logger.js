const winston = require('winston');

// Serverless-friendly logger (no file writing)
const transports = [
  new winston.transports.Console(),  // Log to the console (stdout)
];

// Only add file transport if not in serverless environment
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  transports.push(
    new winston.transports.File({ filename: 'logs/endpoint.log' })
  );
}

const logger = winston.createLogger({
  level: 'info',  // Adjust log level as needed
  format: winston.format.simple(),
  transports: transports,
});

module.exports = logger;
