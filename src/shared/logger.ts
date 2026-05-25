import pino, { type LoggerOptions } from "pino";

const level = process.env.LOG_LEVEL ?? "info";
const pretty = process.env.LOG_PRETTY === "true" && process.env.NODE_ENV !== "production";

const baseOptions: LoggerOptions = {
  level,
  base: { service: "uniid" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "passwordHash",
      "password",
      "*.password",
      "*.passwordHash",
      "*.refreshToken",
      "*.token",
      "*.secret",
      "*.apiKey"
    ],
    censor: "[REDACTED]"
  }
};

export const logger = pretty
  ? pino({
      ...baseOptions,
      transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" } }
    })
  : pino(baseOptions);

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
