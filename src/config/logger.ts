import fs from 'fs';
import path from 'path';
import { getConfig } from './env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  stack?: string;
}

/**
 * Logger class for file-based logging
 */
class Logger {
  private logsDir: string;
  private logLevel: LogLevel;
  private logLevelMap: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(logsDir: string, logLevel: LogLevel = 'info') {
    this.logsDir = logsDir;
    this.logLevel = logLevel;
    this.ensureLogsDir();
  }

  /**
   * Ensures logs directory exists
   */
  private ensureLogsDir(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Formats timestamp as ISO string
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Gets the current log file path
   */
  private getLogFilePath(filename: string): string {
    return path.join(this.logsDir, filename);
  }

  /**
   * Writes a log entry to a file
   */
  private writeToFile(filename: string, entry: LogEntry): void {
    try {
      const filepath = this.getLogFilePath(filename);
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(filepath, logLine);
    } catch (error) {
      console.error(`Failed to write to log file ${filename}:`, error);
    }
  }

  /**
   * Writes to console and log file
   */
  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    filename: string = 'app.log'
  ): void {
    // Check log level
    if (this.logLevelMap[level] < this.logLevelMap[this.logLevel]) {
      return;
    }

    const timestamp = this.getTimestamp();
    const entry: LogEntry = {
      timestamp,
      level,
      message,
      data,
    };

    // Write to file
    this.writeToFile(filename, entry);

    // Console output
    const consoleMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    switch (level) {
      case 'debug':
        console.debug(consoleMessage, data || '');
        break;
      case 'info':
        console.info(consoleMessage, data || '');
        break;
      case 'warn':
        console.warn(consoleMessage, data || '');
        break;
      case 'error':
        console.error(consoleMessage, data || '');
        break;
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: unknown): void {
    this.log('debug', message, data, 'debug.log');
  }

  /**
   * Info level logging
   */
  info(message: string, data?: unknown): void {
    this.log('info', message, data, 'app.log');
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: unknown): void {
    this.log('warn', message, data, 'app.log');
  }

  /**
   * Error level logging
   */
  error(message: string, data?: unknown): void {
    this.log('error', message, data, 'error.log');
  }

  /**
   * Logs unmatched tracks to a JSONL file
   */
  logUnmatchedTrack(data: {
    spotifyId: string;
    trackName: string;
    artistName: string;
    reason: string;
  }): void {
    try {
      const entry = {
        timestamp: this.getTimestamp(),
        ...data,
      };
      const filepath = this.getLogFilePath('unmatched.jsonl');
      fs.appendFileSync(filepath, JSON.stringify(entry) + '\n');
    } catch (error) {
      this.error('Failed to log unmatched track', error);
    }
  }

  /**
   * Logs sync reports to a JSONL file
   */
  logSyncReport(report: Record<string, unknown>): void {
    try {
      const entry = {
        timestamp: this.getTimestamp(),
        ...report,
      };
      const filepath = this.getLogFilePath('sync-reports.jsonl');
      fs.appendFileSync(filepath, JSON.stringify(entry) + '\n');
    } catch (error) {
      this.error('Failed to log sync report', error);
    }
  }

  /**
   * Clears log files (optional maintenance)
   */
  clearLogs(): void {
    try {
      const files = fs.readdirSync(this.logsDir);
      for (const file of files) {
        if (file.endsWith('.log') || file.endsWith('.jsonl')) {
          fs.unlinkSync(path.join(this.logsDir, file));
          this.info(`Cleared log file: ${file}`);
        }
      }
    } catch (error) {
      this.error('Failed to clear logs', error);
    }
  }

  /**
   * Gets the logs directory path
   */
  getLogsDir(): string {
    return this.logsDir;
  }
}

// Initialize logger with config
let loggerInstance: Logger | null = null;

export function initializeLogger(): Logger {
  if (loggerInstance) {
    return loggerInstance;
  }

  const config = getConfig();
  loggerInstance = new Logger(config.logging.logsDir, config.logging.level);
  return loggerInstance;
}

/**
 * Gets the logger instance
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    return initializeLogger();
  }
  return loggerInstance;
}

export { Logger };
