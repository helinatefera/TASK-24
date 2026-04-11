import { Express, Request, Response } from 'express';
import authRoutes from './auth.routes';
import profileRoutes from './profiles.routes';
import privacyRoutes from './privacy.routes';
import consentRoutes from './consent.routes';
import accessRequestRoutes from './accessRequests.routes';
import portfolioRoutes from './portfolios.routes';
import verificationRoutes from './verification.routes';
import jobRoutes from './jobs.routes';
import jobMessageRoutes from './jobMessages.routes';
import workEntryRoutes from './workEntries.routes';
import workEntryDirectRoutes from './workEntriesDirect.routes';
import settlementRoutes from './settlements.routes';
import paymentRoutes from './payments.routes';
import escrowRoutes from './escrow.routes';
import deliverableRoutes from './deliverables.routes';
import fileRoutes from './files.routes';
import reportRoutes from './reports.routes';
import contentReviewRoutes from './contentReview.routes';
import sensitiveWordRoutes from './sensitiveWords.routes';
import auditRoutes from './audit.routes';
import adminRoutes from './admin.routes';

export function mountRoutes(app: Express): void {
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/profiles', profileRoutes);
  app.use('/api/privacy', privacyRoutes);
  app.use('/api/consent', consentRoutes);
  app.use('/api/access-requests', accessRequestRoutes);
  app.use('/api/portfolios', portfolioRoutes);
  app.use('/api/verification', verificationRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/jobs', jobMessageRoutes);
  app.use('/api/jobs', workEntryRoutes);
  app.use('/api/work-entries', workEntryDirectRoutes);
  app.use('/api/jobs', settlementRoutes);
  app.use('/api/jobs', escrowRoutes);
  app.use('/api/jobs', deliverableRoutes);
  app.use('/api/settlements', paymentRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', contentReviewRoutes);
  app.use('/api/admin', sensitiveWordRoutes);
  app.use('/api/admin', auditRoutes);
  app.use('/api/admin', adminRoutes);
}
