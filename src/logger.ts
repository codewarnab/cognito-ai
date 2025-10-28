// Lightweight logger with levels and prefix; respects NODE_ENV
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

export function createLogger(prefix: string, minLevel: LogLevel = getEnvLevel()) {
  const threshold = LEVEL_ORDER[minLevel];
  const isEnabled = (lvl: LogLevel) => LEVEL_ORDER[lvl] >= threshold;

  return {
    debug: (msg: unknown, ...args: unknown[]) => {
      if (isEnabled("debug")) console.debug(...format(prefix, "debug", msg, args));
    },
    info: (msg: unknown, ...args: unknown[]) => {
      if (isEnabled("info")) console.info(...format(prefix, "info", msg, args));
    },
    warn: (msg: unknown, ...args: unknown[]) => {
      if (isEnabled("warn")) console.warn(...format(prefix, "warn", msg, args));
    },
    error: (msg: unknown, ...args: unknown[]) => {
      if (isEnabled("error")) console.error(...format(prefix, "error", msg, args));
    }
  } as const;
}

export const logger = createLogger("App");


