import { describe, it, expect } from 'vitest';

// Extracted maskValue logic for unit testing (mirrors ProfilePage.tsx)
function maskValue(
  field: string,
  value: any,
  isOwn: boolean,
  privacyLevel: string | undefined,
  isAlumni: boolean
): string {
  if (isOwn) return value || '-';
  if (privacyLevel === 'alumni_only' && !isAlumni) return '(Alumni only)';
  if (privacyLevel === 'private') {
    if (!value) return '-';
    const s = String(value);
    if (field === 'phone' && s.length >= 7) return `(${s.slice(0, 3)}) ***-${s.slice(-4)}`;
    if (field === 'phone') return `(***) ***-${s.slice(-4)}`;
    if (field === 'email' && s.includes('@')) {
      const [local, domain] = s.split('@');
      return `${local[0]}***@${domain}`;
    }
    if (field === 'employer') return `${s[0]}${'*'.repeat(Math.min(s.length - 1, 8))}`;
    return '******';
  }
  return value || '-';
}

describe('Profile field-aware masking', () => {
  it('returns raw value for own profile', () => {
    expect(maskValue('phone', '5551234567', true, 'private', false)).toBe('5551234567');
  });

  it('masks phone as (XXX) ***-YYYY for full numbers', () => {
    expect(maskValue('phone', '5551234567', false, 'private', false)).toBe('(555) ***-4567');
  });

  it('masks short phone with (***) ***-XXXX fallback', () => {
    expect(maskValue('phone', '1234', false, 'private', false)).toBe('(***) ***-1234');
  });

  it('masks email as first char + *** @ domain', () => {
    expect(maskValue('email', 'alice@example.com', false, 'private', false)).toBe('a***@example.com');
  });

  it('masks employer with first char + asterisks', () => {
    expect(maskValue('employer', 'Acme Corp', false, 'private', false)).toBe('A********');
  });

  it('returns generic mask for unknown private fields', () => {
    expect(maskValue('bio', 'Some bio text', false, 'private', false)).toBe('******');
  });

  it('shows (Alumni only) for alumni_only fields when viewer is not alumni', () => {
    expect(maskValue('phone', '5551234567', false, 'alumni_only', false)).toBe('(Alumni only)');
  });

  it('shows value for alumni_only fields when viewer is alumni', () => {
    expect(maskValue('phone', '5551234567', false, 'alumni_only', true)).toBe('5551234567');
  });

  it('shows public fields as-is', () => {
    expect(maskValue('firstName', 'Alice', false, 'public', false)).toBe('Alice');
  });

  it('returns dash for empty values', () => {
    expect(maskValue('phone', '', false, 'private', false)).toBe('-');
    expect(maskValue('phone', null, false, 'public', false)).toBe('-');
  });
});

describe('Profile masking edge cases', () => {
  // --- Phone boundary: length >= 7 triggers area code format ---
  it('masks phone with exactly 7 chars using area code format', () => {
    expect(maskValue('phone', '5551234', false, 'private', false)).toBe('(555) ***-1234');
  });

  it('masks phone with 6 chars using short fallback', () => {
    expect(maskValue('phone', '551234', false, 'private', false)).toBe('(***) ***-1234');
  });

  it('masks very short phone (1 char)', () => {
    expect(maskValue('phone', '5', false, 'private', false)).toBe('(***) ***-5');
  });

  it('masks phone with 3 chars', () => {
    expect(maskValue('phone', '567', false, 'private', false)).toBe('(***) ***-567');
  });

  // --- Email edge cases ---
  it('masks email with single-char local part', () => {
    expect(maskValue('email', 'a@x.com', false, 'private', false)).toBe('a***@x.com');
  });

  it('falls back to generic mask for email without @', () => {
    expect(maskValue('email', 'not-an-email', false, 'private', false)).toBe('******');
  });

  it('splits on first @ for email with multiple @ signs', () => {
    // s.split('@') returns ['user', 'weird', 'domain.com'] — domain becomes 'weird'
    const result = maskValue('email', 'user@weird@domain.com', false, 'private', false);
    expect(result).toBe('u***@weird');
  });

  // --- Employer edge cases ---
  it('masks single-char employer name', () => {
    expect(maskValue('employer', 'X', false, 'private', false)).toBe('X');
  });

  it('caps employer asterisks at 8 regardless of name length', () => {
    expect(maskValue('employer', 'International Corp Inc', false, 'private', false)).toBe('I********');
  });

  it('masks 2-char employer correctly', () => {
    expect(maskValue('employer', 'AB', false, 'private', false)).toBe('A*');
  });

  // --- General edge cases ---
  it('returns dash for undefined value on own profile', () => {
    expect(maskValue('phone', undefined, true, 'private', false)).toBe('-');
  });

  it('returns dash for undefined value on public field', () => {
    expect(maskValue('phone', undefined, false, 'public', false)).toBe('-');
  });

  it('returns value when privacy level is undefined (not set)', () => {
    expect(maskValue('firstName', 'Alice', false, undefined, false)).toBe('Alice');
  });

  it('treats numeric 0 as falsy — returns dash', () => {
    expect(maskValue('graduationYear', 0, false, 'public', false)).toBe('-');
  });

  it('displays valid numeric value as-is on public field', () => {
    expect(maskValue('graduationYear', 2024, false, 'public', false)).toBe(2024);
  });

  it('masks private field with numeric value using generic mask', () => {
    expect(maskValue('graduationYear', 2024, false, 'private', false)).toBe('******');
  });

  it('returns raw value for own profile regardless of privacy level', () => {
    expect(maskValue('email', 'alice@example.com', true, 'private', false)).toBe('alice@example.com');
    expect(maskValue('employer', 'Acme', true, 'private', false)).toBe('Acme');
  });
});
