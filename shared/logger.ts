type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.context ? `[${entry.context}] ` : ""}${entry.message}`;
  if (entry.data && Object.keys(entry.data).length > 0) {
    return `${base} ${JSON.stringify(entry.data)}`;
  }
  return base;
}

function log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "debug":
      if (process.env.NODE_ENV === "development") console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export function createLogger(context: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) => log("info", message, context, data),
    warn: (message: string, data?: Record<string, unknown>) => log("warn", message, context, data),
    error: (message: string, data?: Record<string, unknown>) => log("error", message, context, data),
    debug: (message: string, data?: Record<string, unknown>) => log("debug", message, context, data),
  };
}
