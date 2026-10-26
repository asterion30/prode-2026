/**
 * Vercel Web Analytics Integration
 * Initializes web analytics tracking for the application
 */

import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject();

export { inject };
