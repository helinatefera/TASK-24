import { encryptField, decryptField } from '../config/encryption';

export function encrypt(plaintext: string, fieldType: string): string {
  return encryptField(plaintext, fieldType);
}

export function decrypt(ciphertext: string, fieldType: string): string {
  return decryptField(ciphertext, fieldType);
}
