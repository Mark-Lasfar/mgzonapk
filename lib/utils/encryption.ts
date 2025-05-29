import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '73794b6a0f8c949bb3e0e40b8d4c8c7fc1060f5c01427b021485effbdb962492';

if (!ENCRYPTION_KEY) {
  console.error('Error: ENCRYPTION_KEY is not set. Using default key for development.');
  throw new Error('ENCRYPTION_KEY is required');
}

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function validateKey(key: string): Buffer {
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes`);
  }
  return keyBuffer;
}

export function encrypt(text: string | object): string {
  try {
    const input = typeof text === 'object' ? JSON.stringify(text) : text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = validateKey(ENCRYPTION_KEY);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(input, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

export function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    if (textParts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const key = validateKey(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const result = decrypted.toString('utf8');
    try {
      return JSON.parse(result); // Attempt to parse as JSON
    } catch {
      return result; // Return as string if not JSON
    }
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}