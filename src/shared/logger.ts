import { createRequire } from "node:module";
import pino, { type Logger, type LoggerOptions } from "pino";

const require = createRequire(import.meta.url);

const level = process.env.LOG_LEVEL ?? "info";
const usePretty =
  process.env.LOG_PRETTY === "true" && process.env.NODE_ENV !== "production";

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

type Destination = Parameters<typeof pino>[1];

/**
 * Pino `transport` spins up thread-stream workers; Next.js webpack rewrites worker
 * paths under `.next/server/vendor-chunks` and they fail on Windows dev.
 * Pretty-print via in-process pino-pretty stream (loaded at runtime, not bundled).
 */
function createDestination(): Destination {
  if (usePretty) {
    const pretty = require("pino-pretty") as (opts: object) => Destination;
    return pretty({
      colorize: true,
      translateTime: "SYS:HH:MM:ss.l",
      sync: true
    });
  }
  return pino.destination({
    dest: 1,
    sync: process.env.NODE_ENV !== "production"
  });
}

export const logger: Logger = pino(baseOptions, createDestination());

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
