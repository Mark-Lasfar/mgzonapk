// /home/mark/Music/my-nextjs-project-clean/lib/utils/csv.ts
export interface CSVParseOptions {
  delimiter?: string;
  skipHeader?: boolean;
  columns?: string[];
  trim?: boolean;
  currencyFields?: string[];
}

export interface CSVCreateOptions {
  delimiter?: string;
  includeHeader?: boolean;
  customHeaders?: string[];
}

export interface CSVValidationResult {
  valid: boolean;
  errors: string[];
}

export function parseCSV<T>(
  content: string,
  options: CSVParseOptions = {}
): T[] {
  const {
    delimiter = ',',
    skipHeader = false,
    columns = [],
    trim = true,
    currencyFields = [],
  } = options;

  const parseLine = (line: string): string[] => {
    const regex = new RegExp(
      `(?:\\s*\"([^"]*(?:\"\"[^"]*)*)\"\\s*|([^"${delimiter}\\r\\n]*))(?:${delimiter}|$)`,
      'g'
    );
    const result: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      let value = match[1] !== undefined
        ? match[1].replace(/""/g, '"')
        : match[2] ?? '';
      if (trim) value = value.trim();
      result.push(value);
    }

    return result;
  };

  const lines = content
    .split(/\r?\n/)
    .filter(line => line.trim() !== '');

  if (lines.length === 0) return [];

  let headers: string[];
  let dataStartIndex = 1;

  if (columns.length > 0) {
    headers = columns;
    dataStartIndex = 0;
  } else if (skipHeader) {
    headers = [];
    dataStartIndex = 0;
  } else {
    headers = parseLine(lines[0]);
  }

  const results: T[] = [];

  for (let i = dataStartIndex; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const obj: any = {};

    headers.forEach((header, idx) => {
      let value: string | boolean | number = values[idx];

      if (value !== undefined) {
        const lower = value.toLowerCase();
        if (lower === 'true') value = true;
        else if (lower === 'false') value = false;
        else if (!isNaN(Number(value))) value = Number(value);
        else if (currencyFields.includes(header)) {
          value = value.toUpperCase().slice(0, 3);
        }
      }

      obj[header] = value;
    });

    results.push(obj as T);
  }

  return results;
}

export function createCSV(
  data: any[],
  fields: string[],
  options: CSVCreateOptions = {}
): string {
  const {
    delimiter = ',',
    includeHeader = true,
    customHeaders = [],
  } = options;

  if (!Array.isArray(data) || data.length === 0) return '';

  const headers = customHeaders.length > 0 ? customHeaders : fields;
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(headers.join(delimiter));
  }

  for (const row of data) {
    const values = fields.map(field => {
      let value = row[field];
      if (value === null || value === undefined) return '';

      if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else {
        value = String(value);
      }

      const needsQuotes = value.includes(delimiter) || value.includes('"') || value.includes('\n');
      value = value.replace(/"/g, '""');
      return needsQuotes ? `"${value}"` : value;
    });

    lines.push(values.join(delimiter));
  }

  return lines.join('\n');
}

export function validateCSV(
  content: string,
  requiredFields: string[],
  options: CSVParseOptions = {}
): CSVValidationResult {
  const errors: string[] = [];
  const parsed = parseCSV<any>(content, options);

  if (parsed.length === 0) {
    errors.push('CSV is empty or improperly formatted.');
    return { valid: false, errors };
  }

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    for (const field of requiredFields) {
      if (!(field in row)) {
        errors.push(`Row ${i + 1}: Missing required field "${field}".`);
      } else if (row[field] === '' || row[field] === null || row[field] === undefined) {
        errors.push(`Row ${i + 1}: Field "${field}" is empty.`);
      }
    }
    if ('source' in row && !row.source) {
      errors.push(`Row ${i + 1}: Source cannot be empty.`);
    }
    if ('sourceId' in row && !row.sourceId) {
      errors.push(`Row ${i + 1}: Source ID cannot be empty.`);
    }
    if ('sourceStoreId' in row && !row.sourceStoreId) {
      errors.push(`Row ${i + 1}: Source store ID cannot be empty.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function readCSVFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

export function downloadCSV(csvContent: string, filename = 'data.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}