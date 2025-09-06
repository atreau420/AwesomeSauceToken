import serverless from 'serverless-http';
import app from '../../api/index.js';

// Configure serverless wrapper for Netlify with AI marketplace
const serverlessApp = serverless(app, {
    binary: ['image/*', 'font/*', 'audio/*', 'video/*'],
    request: (request, event, context) => {
        // Add Netlify context to request for serverless-specific features
        request.netlify = { event, context };
        request.isServerless = true;
        
        // Add blockchain environment
        if (process.env.PRIVATE_KEY) {
            request.blockchainEnabled = true;
        }
    },
    response: (response, event, context) => {
        // Enhanced security headers for production
        response.headers = {
            ...response.headers,
            'X-Powered-By': 'Awesome Sauce Token AI Marketplace',
            'X-Deployment': 'Netlify Serverless',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        };
    }
});

export const handler = serverlessApp;
