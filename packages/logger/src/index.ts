export type LogLevel = "info" | "warn" | "error" | "debug";
export type LogSource = string;
export type LogFields = Record<string, string | number | boolean | null | undefined>;

const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LEN = 128;

export function readRequestId(request: { headers: Headers }): string {
  const raw = request.headers.get(REQUEST_ID_HEADER);
  if (raw === null) return crypto.randomUUID();
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_REQUEST_ID_LEN) {
    return crypto.randomUUID();
  }
  return trimmed;
}

export function log(
  source: LogSource,
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void {
  const payload: Record<string, unknown> = {
    level,
    source,
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export function createLogger(source: LogSource) {
  return {
    info: (event: string, fields?: LogFields) => log(source, "info", event, fields),
    warn: (event: string, fields?: LogFields) => log(source, "warn", event, fields),
    error: (event: string, fields?: LogFields) => log(source, "error", event, fields),
    debug: (event: string, fields?: LogFields) => {
      if (process.env["LOG_LEVEL"] === "debug") {
        log(source, "debug", event, fields);
      }
    },
  };
}
