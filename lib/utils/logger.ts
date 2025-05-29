type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  timestamp?: boolean;
  prefix?: string;
}

class Logger {
  private static instance: Logger;
  private level: LogLevel = 'info';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) Logger.instance = new Logger();
    return Logger.instance;
  }

  setLogLevel(level: LogLevel) {
    this.level = level;
  }

  private format(level: LogLevel, message: any, options: LogOptions): string {
    const parts: string[] = [];

    if (options.timestamp) parts.push(new Date().toISOString());
    parts.push(`[${level.toUpperCase()}]`);
    if (options.prefix) parts.push(`[${options.prefix}]`);
    parts.push(typeof message === 'object' ? JSON.stringify(message, null, 2) : String(message));

    return parts.join(' ');
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return order.indexOf(level) >= order.indexOf(this.level);
  }

  debug(msg: any, opts: LogOptions = {}) {
    if (this.shouldLog('debug')) console.debug(this.format('debug', msg, { timestamp: true, ...opts }));
  }

  info(msg: any, opts: LogOptions = {}) {
    if (this.shouldLog('info')) console.info(this.format('info', msg, { timestamp: true, ...opts }));
  }

  warn(msg: any, opts: LogOptions = {}) {
    if (this.shouldLog('warn')) console.warn(this.format('warn', msg, { timestamp: true, ...opts }));
  }

  error(msg: any, err?: Error, opts: LogOptions = {}) {
    if (!this.shouldLog('error')) return;
    const formatted = this.format('error', msg, { timestamp: true, ...opts });
    if (err?.stack) {
      console.error(`${formatted}\n${err.stack}`);
    } else {
      console.error(formatted);
    }
  }
}

export const logger = Logger.getInstance();
