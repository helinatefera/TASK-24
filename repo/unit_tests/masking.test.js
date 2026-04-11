const { maskPhone, maskEmail, maskEmployer, maskIdentifier, maskField } = require('/app/dist/utils/masking');

describe('Masking Utils', () => {
  describe('maskPhone', () => {
    test('masks phone with last 4 digits', () => {
      expect(maskPhone('5551234567')).toBe('(XXX) ***-4567');
      expect(maskPhone('15551234567')).toBe('(XXX) ***-4567');
    });

    test('handles formatted phone', () => {
      expect(maskPhone('(555) 123-4567')).toBe('(XXX) ***-4567');
    });

    test('handles short phone', () => {
      expect(maskPhone('123')).toBe('***');
    });

    test('handles empty', () => {
      expect(maskPhone('')).toBe('');
    });
  });

  describe('maskEmail', () => {
    test('masks email keeping first char and domain', () => {
      expect(maskEmail('john@domain.com')).toBe('j***@domain.com');
      expect(maskEmail('alice@test.org')).toBe('a***@test.org');
    });

    test('handles empty', () => {
      expect(maskEmail('')).toBe('');
    });

    test('handles no @ sign', () => {
      expect(maskEmail('invalid')).toBe('***');
    });
  });

  describe('maskEmployer', () => {
    test('masks employer words', () => {
      const result = maskEmployer('Acme Corp');
      expect(result).toContain('A***');
      expect(result).toContain('C***');
    });

    test('handles single char words', () => {
      expect(maskEmployer('A')).toBe('***');
    });

    test('handles empty', () => {
      expect(maskEmployer('')).toBe('');
    });
  });

  describe('maskIdentifier', () => {
    test('masks identifier keeping last 4', () => {
      expect(maskIdentifier('123-45-6789')).toBe('*****6789');
    });

    test('handles short identifier', () => {
      expect(maskIdentifier('1234')).toBe('***');
    });

    test('handles empty', () => {
      expect(maskIdentifier('')).toBe('');
    });
  });

  describe('maskField', () => {
    test('routes to correct mask function', () => {
      expect(maskField('phone', '5551234567')).toBe('(XXX) ***-4567');
      expect(maskField('email', 'john@test.com')).toBe('j***@test.com');
    });
  });
});
