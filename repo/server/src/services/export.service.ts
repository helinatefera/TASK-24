import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';
import { Settlement, SettlementLineItem, User } from '../models';
import { AuditLog } from '../models/AuditLog';
import { Blacklist } from '../models/Blacklist';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { formatCentsToUSD } from '../utils/money';
import { AUDIT_EVENTS } from '../utils/constants';
import { beforeExport } from '../hooks/complianceHooks';
import { BlacklistTargetType, AccountStatus } from '../types/enums';

async function checkExportPermissions(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user || user.accountStatus === AccountStatus.BANNED || user.isBlacklisted) {
    await AuditLog.create({
      timestamp: new Date(), actorId: userId, action: AUDIT_EVENTS.EXPORT_BLOCKED,
      resource: 'settlement', outcome: 'failure', details: { reason: 'banned or blacklisted' },
    });
    throw new ForbiddenError('Export blocked for banned or blacklisted accounts');
  }
  const bl = await Blacklist.findOne({ targetType: BlacklistTargetType.ACCOUNT, targetId: userId });
  if (bl) {
    await AuditLog.create({
      timestamp: new Date(), actorId: userId, action: AUDIT_EVENTS.EXPORT_BLOCKED,
      resource: 'settlement', outcome: 'failure',
    });
    throw new ForbiddenError('Export blocked');
  }
  const hookResult = await beforeExport({ userId, resourceType: 'settlement' });
  if (!hookResult.allow) throw new ForbiddenError(hookResult.reason || 'Export blocked by compliance');
}

export async function exportSettlementPDF(settlementId: string, userId: string): Promise<Buffer> {
  await checkExportPermissions(userId);
  const settlement = await Settlement.findById(settlementId);
  if (!settlement) throw new NotFoundError('Settlement not found');

  // Look up the user's role from the DB — never trust caller-supplied role
  const actor = await User.findById(userId);
  const userRole = actor?.role;

  // Strict access: only job participants or admins may export
  if (userRole !== 'admin') {
    const isParticipant =
      settlement.clientId.toString() === userId ||
      settlement.photographerId.toString() === userId;
    if (!isParticipant) {
      await AuditLog.create({
        timestamp: new Date(), actorId: userId, action: AUDIT_EVENTS.ACCESS_DENIED,
        resource: 'settlement', resourceId: settlementId, outcome: 'failure',
        details: { reason: 'not_a_participant' },
      });
      throw new ForbiddenError('Only job participants or admins can export settlements');
    }
  }

  const lineItems = await SettlementLineItem.find({ settlementId });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      await AuditLog.create({
        timestamp: new Date(), actorId: userId, action: AUDIT_EVENTS.DATA_EXPORT,
        resource: 'settlement', resourceId: settlementId, outcome: 'success', details: { format: 'pdf' },
      });
      resolve(buffer);
    });
    doc.on('error', reject);

    doc.fontSize(20).text('Settlement Statement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Settlement ID: ${settlementId}`);
    doc.text(`Status: ${settlement.status}`);
    doc.text(`Subtotal: ${formatCentsToUSD(settlement.subtotalCents)}`);
    doc.text(`Adjustments: ${formatCentsToUSD(settlement.adjustmentCents)}`);
    doc.text(`Final Amount: ${formatCentsToUSD(settlement.finalAmountCents)}`);
    if (settlement.varianceReason) doc.text(`Variance Reason: ${settlement.varianceReason}`);
    doc.moveDown();
    doc.fontSize(14).text('Line Items');
    doc.moveDown();
    for (const item of lineItems) {
      doc.fontSize(10).text(`${item.description}: ${formatCentsToUSD(item.amountCents)} (${item.type})`);
    }
    doc.end();
  });
}

export async function exportSettlementCSV(settlementId: string, userId: string): Promise<Buffer> {
  await checkExportPermissions(userId);
  const settlement = await Settlement.findById(settlementId);
  if (!settlement) throw new NotFoundError('Settlement not found');

  // Look up the user's role from the DB — never trust caller-supplied role
  const actor = await User.findById(userId);
  const userRole = actor?.role;

  // Strict access: only job participants or admins may export
  if (userRole !== 'admin') {
    const isParticipant =
      settlement.clientId.toString() === userId ||
      settlement.photographerId.toString() === userId;
    if (!isParticipant) {
      await AuditLog.create({
        timestamp: new Date(), actorId: userId, action: AUDIT_EVENTS.ACCESS_DENIED,
        resource: 'settlement', resourceId: settlementId, outcome: 'failure',
        details: { reason: 'not_a_participant' },
      });
      throw new ForbiddenError('Only job participants or admins can export settlements');
    }
  }

  const lineItems = await SettlementLineItem.find({ settlementId });

  const rows: Record<string, string>[] = lineItems.map(item => ({
    description: item.description,
    amount: formatCentsToUSD(item.amountCents),
    type: item.type as string,
    adjustmentType: (item.adjustmentType || '') as string,
    adjustmentReason: item.adjustmentReason || '',
  }));
  rows.push({ description: 'TOTAL', amount: formatCentsToUSD(settlement.finalAmountCents), type: '', adjustmentType: '', adjustmentReason: '' });

  const csv = stringify(rows, { header: true });
  await AuditLog.create({
    timestamp: new Date(), actorId: userId, action: AUDIT_EVENTS.DATA_EXPORT,
    resource: 'settlement', resourceId: settlementId, outcome: 'success', details: { format: 'csv' },
  });
  return Buffer.from(csv);
}
