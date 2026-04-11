export function maskPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const last4 = digits.slice(-4);
  return `(XXX) ***-${last4}`;
}

export function maskEmail(email: string): string {
  if (!email) return '';
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '***';
  const firstChar = email[0];
  const domain = email.slice(atIndex);
  return `${firstChar}***${domain}`;
}

export function maskEmployer(employer: string): string {
  if (!employer) return '';
  if (employer.length <= 1) return '***';
  const words = employer.split(' ');
  return words.map(w => w.length <= 1 ? w : w[0] + '***').join(' ');
}

export function maskIdentifier(identifier: string): string {
  if (!identifier) return '';
  const clean = identifier.replace(/[-\s]/g, '');
  if (clean.length <= 4) return '***';
  const last4 = clean.slice(-4);
  const maskedPart = '*'.repeat(clean.length - 4);
  return maskedPart + last4;
}

export type MaskableField = 'phone' | 'email' | 'employer' | 'identifier';

export function maskField(fieldName: string, value: string): string {
  switch (fieldName) {
    case 'phone': return maskPhone(value);
    case 'email': return maskEmail(value);
    case 'employer': return maskEmployer(value);
    default: return maskIdentifier(value);
  }
}
