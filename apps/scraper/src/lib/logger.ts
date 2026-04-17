type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = {
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
};

export function log(fields: LogFields): void {
  const record = {
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(record);
  if (fields.level === "error" || fields.level === "warn") {
    console.error(line);
  } else {
    console.info(line);
  }
}
