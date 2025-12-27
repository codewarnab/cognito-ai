// Lightweight logger with levels and prefix; respects NODE_ENV
import { LOG_PRESETS } from '@/constants';
import type { LogCategory, LogEntry } from '@cognito/shared';

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function getEnvLevel(): LogLevel {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  return env === "production" ? "info" : "debug";
}

// ============================================================================
// LoggerConfigManager - Dynamic Configuration Singleton
// ============================================================================

type LoggerConfig = Record<LogCategory, boolean>;

/**
 * Singleton manager for dynamic logger configuration.
 * Maintains an in-memory cache and subscribes to storage changes for live updates.
 */
class LoggerConfigManagerClass {
  private config: LoggerConfig;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start with DEVELOPMENT preset as default
    this.config = { ...LOG_PRESETS.DEVELOPMENT } as LoggerConfig;
  }

  /**
   * Initialize the manager by loading config from storage.
   * Safe to call multiple times - will only initialize once.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Prevent multiple concurrent initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      // Load config from storage
      const result = await chrome.storage.local.get('logger_config');
      const stored = result?.['logger_config'] as LoggerConfig | undefined;

      if (stored) {
        // Merge with default to ensure all categories exist
        this.config = {
          ...LOG_PRESETS.DEVELOPMENT,
          ...stored,
        } as LoggerConfig;
      }

      // Subscribe to storage changes for live updates
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes['logger_config']) {
          const newConfig = changes['logger_config'].newValue as LoggerConfig | undefined;
          if (newConfig) {
            this.config = {
              ...LOG_PRESETS.DEVELOPMENT,
              ...newConfig,
            } as LoggerConfig;
          }
        }
      });

      this.initialized = true;
    } catch (error) {
      // Fallback to default preset on error
      console.error('[LoggerConfigManager] Failed to initialize:', error);
      this.config = { ...LOG_PRESETS.DEVELOPMENT } as LoggerConfig;
      this.initialized = true;
    }
  }

  /**
   * Check if a category is enabled in the current configuration.
   */
  isCategoryEnabled(category?: LogCategory): boolean {
    // Special overrides
    if (this.config.SHOW_ALL) return true;
    if (this.config.ERRORS_ONLY) return false;

    // If no category specified, default to enabled
    if (!category) return true;

    // Check category-specific setting
    return this.config[category] ?? true;
  }

  /**
   * Check if ERRORS_ONLY mode is active
   */
  isErrorsOnlyMode(): boolean {
    return this.config.ERRORS_ONLY;
  }

  /**
   * Get the current configuration (for debugging)
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const LoggerConfigManager = new LoggerConfigManagerClass();

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Check if a log category is enabled based on dynamic configuration
 */
function isCategoryEnabled(category?: LogCategory): boolean {
  return LoggerConfigManager.isCategoryEnabled(category);
}

/**
 * Safely serialize an error or unknown value for logging
 */
function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value as any) // Capture any additional properties
    };
  }

  if (value && typeof value === 'object') {
    // Check if it's a plain object with properties
    try {
      // Try to get meaningful properties
      const obj = value as Record<string, any>;
      if (obj.message || obj.error || obj.type) {
        return {
          ...(obj.message && { message: obj.message }),
          ...(obj.error && { error: serializeValue(obj.error) }),
          ...(obj.type && { type: obj.type }),
          ...(obj.originalError && { originalError: serializeValue(obj.originalError) }),
          ...obj
        };
      }
    } catch (e) {
      // Fallback to string representation
    }
  }

  return value;
}

function format(prefix: string, level: LogLevel, msg: unknown, args: unknown[]) {
  const time = new Date().toISOString();
  const serializedArgs = args.map(serializeValue);
  return [`[${time}] [${prefix}] [${level.toUpperCase()}]`, msg, ...serializedArgs];
}

// ============================================================================
// Log Broadcasting & History
// ============================================================================

class LogHistoryClass {
  private buffer: LogEntry[] = [];
  private readonly maxSize = 1000;

  add(entry: LogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getHistory(): LogEntry[] {
    return [...this.buffer];
  }
}

export const LogHistory = new LogHistoryClass();

class LogBroadcasterClass {
  private ports: chrome.runtime.Port[] = [];

  constructor() {
    // Only setup if in extension context
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onConnectExternal) {
        this.setupListener();
      }
    } catch (e) {
      // Ignore during build/test where API might be mocked but not implemented
    }
  }

  private setupListener() {
    chrome.runtime.onConnectExternal.addListener((port) => {
      if (port.name === 'logger') {
        this.ports.push(port);

        // Send history immediately upon connection
        const history = LogHistory.getHistory();
        history.forEach(entry => {
          try {
            port.postMessage(entry)
          } catch (e) {
            // Ignore connection errors during history replay
          }
        });

        port.onDisconnect.addListener(() => {
          this.ports = this.ports.filter(p => p !== port);
        });
      }
    });
  }

  broadcast(entry: LogEntry) {
    // Always add to history
    LogHistory.add(entry);

    // Broadcast to connected ports
    if (this.ports.length > 0) {
      this.ports.forEach(port => {
        try {
          port.postMessage(entry);
        } catch (e) {
          this.ports = this.ports.filter(p => p !== port);
        }
      });
    }
  }
}

export const LogBroadcaster = new LogBroadcasterClass();

export function createLogger(
  prefix: string,
  category?: LogCategory,
  minLevel: LogLevel = getEnvLevel()
) {
  const threshold = LEVEL_ORDER[minLevel];
  const isEnabled = (lvl: LogLevel) => LEVEL_ORDER[lvl] >= threshold;

  const log = (level: LogLevel, msg: unknown, args: unknown[]) => {
    // 1. Console Output
    const formatted = format(prefix, level, msg, args);

    const isConsoleEnabled =
      level === 'error'
        ? (LoggerConfigManager.isErrorsOnlyMode() ? true : (isEnabled('error') && (isCategoryEnabled(category) || true)))
        : (isEnabled(level) && isCategoryEnabled(category));

    if (isConsoleEnabled) {
      // eslint-disable-next-line no-console
      console[level](...formatted);
    }

    // 2. Broadcast to DevTools (always broadcast if we can, let the UI filter)
    // We broadcast everything so the DevTools can show/hide even if console output is silenced
    try {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level,
        category,
        message: msg,
        args: args.map(serializeValue),
        prefix
      };
      LogBroadcaster.broadcast(entry);
    } catch (e) {
      // Fail silently on broadcast errors
    }
  };

  return {
    debug: (msg: unknown, ...args: unknown[]) => log('debug', msg, args),
    info: (msg: unknown, ...args: unknown[]) => log('info', msg, args),
    warn: (msg: unknown, ...args: unknown[]) => log('warn', msg, args),
    error: (msg: unknown, ...args: unknown[]) => log('error', msg, args)
  } as const;
}

export const logger = createLogger("App");
