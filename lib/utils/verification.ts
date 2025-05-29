import { createWorker } from 'tesseract.js';

interface VerificationResult {
  verified: boolean;
  confidence: number;
  details: Record<string, any>;
  error?: string;
}

interface DocumentFields {
  [key: string]: {
    pattern: RegExp;
    required: boolean;
    validator?: (value: string) => boolean;
  };
}

// Define document field patterns for different document types.
const DOCUMENT_PATTERNS = {
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
      validator: (date: string) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
      },
    },
    expiryDate: {
      pattern: /(?:expiry|expiration|valid until)[:]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      required: true,
      validator: (date: string) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
      },
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
      validator: (date: string) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
      },
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
} as const;

// Main function to download a document from a URL, perform OCR, and verify its text.
export async function verifyDocument(
  documentUrl: string,
  type: 'businessLicense' | 'taxDocument' | 'identityProof'
): Promise<VerificationResult> {
  try {
    // Download document from the provided URL.
    const response = await fetch(documentUrl);
    const buffer = await response.arrayBuffer();

    // Perform OCR on the downloaded document.
    const extractedText = await performOCR(buffer);

    // Verify the extracted text against the field patterns.
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

// Helper to perform OCR using Tesseract.js.
async function performOCR(buffer: ArrayBuffer): Promise<string> {
  const worker = await createWorker();

  try {
    await worker.reinitialize('eng');
    const {
      data: { text },
    } = await worker.recognize(Buffer.from(buffer));
    await worker.terminate();
    return text;
  } catch (error) {
    await worker.terminate();
    throw new Error('OCR failed');
  }
}

// Matches and validates document fields in extracted text.
async function verifyDocumentText(
  text: string,
  type: keyof typeof DOCUMENT_PATTERNS
): Promise<VerificationResult> {
  const fields = DOCUMENT_PATTERNS[type];
  const extractedData: Record<string, string> = {};
  let matchedFields = 0;
  let requiredFields = 0;

  // Process each field defined in the pattern.
  for (const [fieldName, field] of Object.entries(fields)) {
    if (field.required) requiredFields++;

    const match = text.match(field.pattern);
    if (match && match[1]) {
      const value = match[1].trim();

      // If a validator is provided, use it.
      if (field.validator && !field.validator(value)) {
        continue;
      }

      extractedData[fieldName] = value;
      if (field.required) matchedFields++;
    }
  }

  // Calculate a confidence score based on required fields.
  const confidence = requiredFields > 0 ? matchedFields / requiredFields : 0;
  const verified = confidence >= 0.7; // 70% threshold for verification.

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

// Additional helper validators.
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

export function generateRecoveryCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function validateTaxId(taxId: string): boolean {
  return /^[A-Z0-9-]{9,}$/i.test(taxId);
}

// New function to generate a verification code
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