// Lightweight logger with levels and prefix; respects NODE_ENV
import { LOG_PRESETS } from '@/constants';
import type { LogCategory } from '@/types/logger';

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

export function createLogger(
  prefix: string,
  category?: LogCategory,
  minLevel: LogLevel = getEnvLevel()
) {
  const threshold = LEVEL_ORDER[minLevel];
  const isEnabled = (lvl: LogLevel) => LEVEL_ORDER[lvl] >= threshold;

  return {
    debug: (msg: unknown, ...args: unknown[]) => {
      if (isEnabled("debug") && isCategoryEnabled(category)) {
        console.debug(...format(prefix, "debug", msg, args));
      }
    },
    info: (msg: unknown, ...args: unknown[]) => {
      if (isEnabled("info") && isCategoryEnabled(category)) {
        console.info(...format(prefix, "info", msg, args));
      }
    },
    warn: (msg: unknown, ...args: unknown[]) => {
      if (isEnabled("warn") && isCategoryEnabled(category)) {
        console.warn(...format(prefix, "warn", msg, args));
      }
    },
    error: (msg: unknown, ...args: unknown[]) => {
      // ALWAYS show errors unless ERRORS_ONLY is specifically false
      // AND category is disabled
      const shouldShow = LoggerConfigManager.isErrorsOnlyMode() ? true :
        (isEnabled("error") && (isCategoryEnabled(category) || true));
      if (shouldShow) {
        console.error(...format(prefix, "error", msg, args));
      }
    }
  } as const;
}

export const logger = createLogger("App");
