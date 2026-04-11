// Set required env vars before importing
process.env.MASTER_ENCRYPTION_KEY = '7f4a8b2c1d3e5f6071829a0b4c5d6e7f8091a2b3c4d5e6f70182939a0b1c2d3e';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long-for-validation';

const { encryptField, decryptField } = require('/app/dist/config/encryption');

describe('Encryption Service', () => {
  test('encrypt and decrypt round-trip', () => {
    const plaintext = 'sensitive-data-123';
    const encrypted = encryptField(plaintext, 'government_id');
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decryptField(encrypted, 'government_id');
    expect(decrypted).toBe(plaintext);
  });

  test('different field types produce different ciphertexts', () => {
    const plaintext = 'same-data';
    const enc1 = encryptField(plaintext, 'government_id');
    const enc2 = encryptField(plaintext, 'tax_form');
    expect(enc1).not.toBe(enc2);
  });

  test('same field type produces different ciphertexts (random IV)', () => {
    const plaintext = 'test-data';
    const enc1 = encryptField(plaintext, 'government_id');
    const enc2 = encryptField(plaintext, 'government_id');
    expect(enc1).not.toBe(enc2); // Different IVs
  });

  test('tampered ciphertext throws', () => {
    const encrypted = encryptField('data', 'government_id');
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    expect(() => decryptField(tampered, 'government_id')).toThrow();
  });

  test('wrong field type cannot decrypt', () => {
    const encrypted = encryptField('data', 'government_id');
    expect(() => decryptField(encrypted, 'tax_form')).toThrow();
  });

  test('handles unicode text', () => {
    const plaintext = 'Ñoño García 日本語';
    const encrypted = encryptField(plaintext, 'real_name');
    const decrypted = decryptField(encrypted, 'real_name');
    expect(decrypted).toBe(plaintext);
  });

  test('handles empty string', () => {
    const encrypted = encryptField('', 'government_id');
    const decrypted = decryptField(encrypted, 'government_id');
    expect(decrypted).toBe('');
  });
});
