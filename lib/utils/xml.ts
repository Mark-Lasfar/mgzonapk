import { DOMParser } from 'xmldom';
import { readFileSync } from 'fs';
import { SellerError } from '@/lib/errors/seller-error';
import { customLogger } from '@/lib/api/services/logging';

interface XMLParseOptions {
  removeNamespaces?: boolean;
  dateFields?: string[];
  numberFields?: string[];
  booleanFields?: string[];
  arrayFields?: string[];
  currencyFields?: string[];
}

interface XMLCreateOptions {
  rootTag?: string;
  pretty?: boolean;
  indent?: string;
  declaration?: boolean;
}

export async function readXMLFile<T>(filePath: string, options: XMLParseOptions = {}): Promise<T[]> {
  const requestId = crypto.randomUUID();
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseXML<T>(content, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Failed to read XML file', {
      requestId,
      filePath,
      error: errorMessage,
      service: 'xml-utils',
    });
    throw new SellerError('XML_READ_FAILED', `Failed to read XML file: ${errorMessage}`);
  }
}

export function parseXML<T>(content: string, options: XMLParseOptions = {}): T[] {
  const {
    removeNamespaces = true,
    dateFields = [],
    numberFields = [],
    booleanFields = [],
    arrayFields = [],
    currencyFields = [],
  } = options;

  const requestId = crypto.randomUUID();
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    const parseError = doc.querySelector('parsererror');

    if (parseError) {
      throw new SellerError('XML_PARSE_ERROR', `XML Parse Error: ${parseError.textContent}`);
    }

    const convertNode = (node: Element): any => {
      const result: Record<string, any> = {};

      for (const attr of Array.from(node.attributes)) {
        result[`@${attr.name}`] = attr.value;
      }

      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as Element;
          const tagName = removeNamespaces ? el.tagName.split(':').pop()! : el.tagName;
          const childValue = convertNode(el);

          if (arrayFields.includes(tagName)) {
            result[tagName] = result[tagName] || [];
            result[tagName].push(childValue);
          } else {
            result[tagName] = childValue;
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim();
          if (text) {
            const tag = node.tagName;
            if (dateFields.includes(tag)) result['#text'] = new Date(text);
            else if (numberFields.includes(tag)) result['#text'] = Number(text);
            else if (booleanFields.includes(tag)) result['#text'] = text.toLowerCase() === 'true';
            else if (currencyFields.includes(tag)) result['#text'] = text.toUpperCase().slice(0, 3);
            else result['#text'] = text;
          }
        }
      }

      return Object.keys(result).length === 1 && '#text' in result ? result['#text'] : result;
    };

    const result = Array.from(doc.documentElement.children).map(el => convertNode(el as Element)) as T[];
    customLogger.info('XML parsed successfully', { requestId, service: 'xml-utils' });
    return result;
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : String(error);
    customLogger.error('Failed to parse XML', { requestId, error: errorMessage, service: 'xml-utils' });
    throw error instanceof SellerError ? error : new SellerError('XML_PARSE_FAILED', errorMessage);
  }
}

export function createXML(
  rootTag: string = 'root',
  data: any[],
  fields: string[],
  options: XMLCreateOptions = {}
): string {
  const { pretty = true, indent = '  ', declaration = true } = options;
  const requestId = crypto.randomUUID();

  try {
    const escape = (val: string) =>
      val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const serialize = (obj: any, depth = 0): string => {
      const pad = pretty ? '\n' + indent.repeat(depth) : '';
      let xml = '';

      for (const field of fields) {
        if (!(field in obj)) continue;
        const value = obj[field];
        if (value == null) continue;

        xml += `${pad}<${field}>`;

        if (Array.isArray(value)) {
          for (const item of value) {
            xml += typeof item === 'object'
              ? serialize(item, depth + 1)
              : `${pad}${indent}<item>${escape(String(item))}</item>`;
          }
        } else if (typeof value === 'object') {
          xml += serialize(value, depth + 1);
        } else {
          xml += escape(String(value));
        }

        xml += `</${field}>`;
      }

      return xml;
    };

    let xml = declaration ? '<?xml version="1.0" encoding="UTF-8"?>' : '';
    if (pretty) xml += '\n';
    xml += `<${rootTag}>`;

    for (const item of data) {
      xml += `${pretty ? '\n' + indent : ''}<item>`;
      xml += serialize(item, pretty ? 2 : 0);
      xml += `${pretty ? '\n' + indent : ''}</item>`;
    }

    xml += pretty ? '\n' : '';
    xml += `</${rootTag}>`;

    customLogger.info('XML created successfully', { requestId, rootTag, service: 'xml-utils' });
    return xml;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed to create XML', { requestId, error: errorMessage, service: 'xml-utils' });
    throw new SellerError('XML_CREATE_FAILED', errorMessage);
  }
}

export function validateXML(
  content: string,
  requiredFields: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requestId = crypto.randomUUID();

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');

    if (doc.querySelector('parsererror')) {
      errors.push('Invalid XML format.');
      customLogger.error('Invalid XML format during validation', { requestId, service: 'xml-utils' });
      return { valid: false, errors };
    }

    const items = doc.querySelectorAll('item');
    if (items.length === 0) {
      errors.push('No <item> elements found.');
      customLogger.error('No item elements found in XML', { requestId, service: 'xml-utils' });
      return { valid: false, errors };
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      for (const field of requiredFields) {
        if (!item.querySelector(field)) {
          errors.push(`Item ${i + 1}: Missing required field: <${field}>`);
        }
      }
      if (item.querySelector('source')?.textContent === '') {
        errors.push(`Item ${i + 1}: Source cannot be empty.`);
      }
      if (item.querySelector('sourceId')?.textContent === '') {
        errors.push(`Item ${i + 1}: Source ID cannot be empty.`);
      }
      if (item.querySelector('sourceStoreId')?.textContent === '') {
        errors.push(`Item ${i + 1}: Source store ID cannot be empty.`);
      }
    }

    const result = { valid: errors.length === 0, errors };
    customLogger.info('XML validated', { requestId, valid: result.valid, errors: result.errors, service: 'xml-utils' });
    return result;
  } catch (err: any) {
    const errorMessage = `Validation error: ${err.message}`;
    errors.push(errorMessage);
    customLogger.error('XML validation failed', { requestId, error: errorMessage, service: 'xml-utils' });
    return { valid: false, errors };
  }
}