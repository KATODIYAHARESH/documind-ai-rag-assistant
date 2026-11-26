type Level = "debug" | "info" | "warn" | "error";
type Meta = Record<string, unknown> | undefined;

function write(level: Level, message: string, meta: Meta): void {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    service: "documind-api",
    ...(meta ?? {}),
  };
  const line = JSON.stringify(entry, (_key, value: unknown) =>
    value instanceof Error ? { name: value.name, message: value.message } : value,
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Meta) => write("debug", message, meta),
  info: (message: string, meta?: Meta) => write("info", message, meta),
  warn: (message: string, meta?: Meta) => write("warn", message, meta),
  error: (message: string, meta?: Meta) => write("error", message, meta),
};
