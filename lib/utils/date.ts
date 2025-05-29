// ملف جديد للتعامل مع التواريخ

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function formatDate(date: Date | string): string {
  return new Date(date).toISOString().split('T')[0];
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

export function getCurrentDateTime(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').slice(0, 19);
}

export function isValidDateTime(date: string): boolean {
  const timestamp = Date.parse(date);
  return !isNaN(timestamp);
}