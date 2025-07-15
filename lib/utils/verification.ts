import { createWorker } from 'tesseract.js';

interface VerificationResult {
  verified: boolean;
  confidence: number;
  details: Record<string, any>;
  error?: string;
}

interface DocumentField {
  pattern: RegExp;
  required: boolean;
  validator?: (value: string) => boolean;
}

interface DocumentPatterns {
  [key: string]: {
    [fieldName: string]: DocumentField;
  };
}

const DOCUMENT_PATTERNS: DocumentPatterns = {
  businessLicense: {
    businessName: {
      pattern: /(?:business|company|enterprise)\s*(?:name)?[:]\s*([A-Za-z0-9\s.,&-]+)/i,
      required: true,
    },
    licenseNumber: {
      pattern: /(?:license|permit|registration)\s*(?:number|#|no)[:.\s]*([A-Z0-9-]+)/i,
      required: true,
    },
    issueDate: {
      pattern: /(?:issue|issued)\s*(?:date|on)[:]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      required: true,
      validator: (date: string) => validateDate(date),
    },
    expiryDate: {
      pattern: /(?:expiry|expiration|valid until)[:]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      required: true,
      validator: (date: string) => validateDate(date),
    },
  },
  taxDocument: {
    taxId: {
      pattern: /(?:tax\s*id|ein|tin)[:.\s]*([A-Z0-9-]+)/i,
      required: true,
    },
    businessName: {
      pattern: /(?:business|company|enterprise)\s*name[:]\s*([A-Za-z0-9\s.,&-]+)/i,
      required: true,
    },
    taxPeriod: {
      pattern: /(?:tax\s*period|period|year)[:]\s*(\d{4}(?:-\d{2,4})?)/i,
      required: true,
    },
    amount: {
      pattern: /(?:amount|total|sum)[:]\s*[\$€£]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
      required: false,
    },
  },
  identityProof: {
    fullName: {
      pattern: /(?:name|full\s*name)[:]\s*([A-Za-z\s.-]+)/i,
      required: true,
    },
    dateOfBirth: {
      pattern: /(?:date\s*of\s*birth|dob|born)[:]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      required: true,
      validator: (date: string) => validateDate(date),
    },
    documentNumber: {
      pattern: /(?:document|id|passport)\s*(?:number|#|no)[:.\s]*([A-Z0-9-]+)/i,
      required: true,
    },
    nationality: {
      pattern: /(?:nationality|country)[:]\s*([A-Za-z\s]+)/i,
      required: false,
    },
  },
};

export async function verifyDocument(
  documentUrl: string,
  type: keyof typeof DOCUMENT_PATTERNS
): Promise<VerificationResult> {
  try {
    const response = await fetch(documentUrl);
    if (!response.ok) throw new Error('Failed to fetch document');
    const buffer = await response.arrayBuffer();
    const extractedText = await performOCR(buffer);
    return await verifyDocumentText(extractedText, type);
  } catch (error) {
    console.error('Document verification error:', error);
    return {
      verified: false,
      confidence: 0,
      details: {},
      error: 'Failed to verify document',
    };
  }
}

async function performOCR(buffer: ArrayBuffer): Promise<string> {
  const worker = await createWorker('eng');
  try {
    const {
      data: { text },
    } = await worker.recognize(Buffer.from(buffer));
    return text;
  } finally {
    await worker.terminate();
  }
}

async function verifyDocumentText(
  text: string,
  type: keyof typeof DOCUMENT_PATTERNS
): Promise<VerificationResult> {
  const fields = DOCUMENT_PATTERNS[type];
  const extractedData: Record<string, string> = {};
  let matchedFields = 0;
  let requiredFields = 0;

  for (const [fieldName, field] of Object.entries(fields)) {
    if (field.required) requiredFields++;
    const match = text.match(field.pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      if (typeof field.validator === 'function' && !field.validator(value)) {
        continue;
      }
      extractedData[fieldName] = value;
      if (field.required) matchedFields++;
    }
  }

  const confidence = requiredFields > 0 ? matchedFields / requiredFields : 0;
  const verified = confidence >= 0.7;

  return {
    verified,
    confidence,
    details: {
      documentType: type,
      extractedData,
      matchedFields,
      requiredFields,
      verificationDate: new Date().toISOString(),
    },
  };
}

export function validateDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export function validateDocumentNumber(num: string): boolean {
  return /^[A-Z0-9-]{6,}$/i.test(num);
}

export function validateName(name: string): boolean {
  return /^[A-Za-z\s.-]{2,}$/i.test(name);
}

export function generateRecoveryCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function validateTaxId(taxId: string): boolean {
  return /^[A-Z0-9-]{9,}$/i.test(taxId);
}

export function generateVerificationCode(length: number = 8): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
}

export const DocumentVerification = {
  verifyDocument,
  validateDate,
  validateDocumentNumber,
  validateName,
  validateTaxId,
  generateRecoveryCode,
  generateVerificationCode,
};