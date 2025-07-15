import crypto from 'crypto';

/**
 * Encryption configuration
 */
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits (32 bytes)

/**
 * Get and validate encryption key
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    console.warn('ENCRYPTION_KEY not set. Using default key for development only.');
    return Buffer.from('default-32-char-key-1234567890abcdef'); // Development-only fallback
  }
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  try {
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== KEY_LENGTH) {
      throw new Error('Invalid ENCRYPTION_KEY length after decoding');
    }
    return key;
  } catch (error) {
    throw new Error('Invalid ENCRYPTION_KEY format: must be a valid hex string');
  }
}

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Encrypts a string using AES-256-CBC
 * @param text - The string to encrypt
 * @returns A string in the format `iv:encrypted` (hex-encoded)
 * @throws Error if encryption fails
 */
export function encrypt(text: string): string {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Input must be a non-empty string');
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', {
      message: error instanceof Error ? error.message : String(error),
      inputLength: text?.length || 0,
    });
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypts a string encrypted with AES-256-CBC
 * @param text - The encrypted string in the format `iv:encrypted` (hex-encoded)
 * @param parseJson - Whether to attempt JSON parsing of the decrypted string
 * @returns The decrypted string or parsed JSON object
 * @throws Error if decryption fails
 */
export function decrypt<T = string>(text: string, parseJson: boolean = false): T {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Input must be a non-empty string');
    }
    const [ivHex, encryptedHex] = text.split(':');
    if (!ivHex || !encryptedHex || ivHex.length !== IV_LENGTH * 2) {
      throw new Error('Invalid encrypted text format or IV length');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    if (parseJson) {
      return JSON.parse(decrypted) as T;
    }
    return decrypted as T;
  } catch (error) {
    console.error('Decryption error:', {
      message: error instanceof Error ? error.message : String(error),
      inputLength: text?.length || 0,
    });
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : String(error)}`);
  }
}