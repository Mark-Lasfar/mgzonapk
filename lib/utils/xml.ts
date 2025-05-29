interface XMLParseOptions {
    removeNamespaces?: boolean;
    dateFields?: string[];
    numberFields?: string[];
    booleanFields?: string[];
    arrayFields?: string[];
  }
  
  interface XMLCreateOptions {
    rootTag?: string;
    pretty?: boolean;
    indent?: string;
    declaration?: boolean;
  }
  
  export function parseXML<T>(content: string, options: XMLParseOptions = {}): T[] {
    const {
      removeNamespaces = true,
      dateFields = [],
      numberFields = [],
      booleanFields = [],
      arrayFields = [],
    } = options;
  
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    const parseError = doc.querySelector('parsererror');
  
    if (parseError) {
      throw new Error(`XML Parse Error: ${parseError.textContent}`);
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
            else result['#text'] = text;
          }
        }
      }
  
      return Object.keys(result).length === 1 && '#text' in result ? result['#text'] : result;
    };
  
    return Array.from(doc.documentElement.children).map(el => convertNode(el as Element)) as T[];
  }
  
  export function createXML(
    rootTag: string,
    data: any[],
    fields: string[],
    options: XMLCreateOptions = {}
  ): string {
    const { pretty = true, indent = '  ', declaration = true } = options;
  
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
  
    return xml;
  }
  
  export function validateXML(
    content: string,
    requiredFields: string[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
  
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'application/xml');
  
      if (doc.querySelector('parsererror')) {
        errors.push('Invalid XML format.');
        return { valid: false, errors };
      }
  
      const firstItem = doc.querySelector('item');
      if (!firstItem) {
        errors.push('No <item> elements found.');
        return { valid: false, errors };
      }
  
      for (const field of requiredFields) {
        if (!firstItem.querySelector(field)) {
          errors.push(`Missing required field: <${field}>`);
        }
      }
  
      return { valid: errors.length === 0, errors };
    } catch (err: any) {
      errors.push(`Validation error: ${err.message}`);
      return { valid: false, errors };
    }
  }
  