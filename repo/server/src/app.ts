import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestId } from './middleware/requestId';
import { rateLimiter, accountRateLimiter } from './middleware/rateLimiter';
import { nonceReplay } from './middleware/nonceReplay';
import { auditLogger } from './middleware/auditLogger';
import { authenticate } from './middleware/authenticate';
import { blacklistCheck } from './middleware/blacklistCheck';
import { deviceFingerprintMiddleware } from './middleware/deviceFingerprint';
import { errorHandler } from './middleware/errorHandler';
import { mountRoutes } from './routes';

const app = express();

// 1. Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// 2. CORS
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Nonce', 'X-Timestamp', 'X-Device-Fingerprint', 'X-Request-Id'],
}));

// 3. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Request ID
app.use(requestId);

// 5. Rate limiting (before auth to catch brute force)
app.use(rateLimiter);

// 6. Nonce replay protection
app.use(nonceReplay);

// 7. Audit logger (pre)
app.use(auditLogger);

// 8. Authentication
app.use(authenticate);

// 9. Per-account rate limiter (post-auth)
app.use(accountRateLimiter);

// 10. Blacklist check
app.use(blacklistCheck);

// 11. Device fingerprint (consent-gated)
app.use(deviceFingerprintMiddleware);

// 12. Routes
mountRoutes(app);

// 13. Error handler (must be last)
app.use(errorHandler);

export default app;
