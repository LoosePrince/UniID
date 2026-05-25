import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

let ajvSingleton: Ajv | undefined;
const cache = new Map<string, ValidateFunction>();

export function ajv(): Ajv {
  if (ajvSingleton) return ajvSingleton;
  ajvSingleton = new Ajv({
    allErrors: true,
    useDefaults: true,
    coerceTypes: false,
    removeAdditional: false,
    strict: false
  });
  addFormats(ajvSingleton);
  return ajvSingleton;
}

export function compileSchemaCached(schemaId: string, schema: object): ValidateFunction {
  const key = `${schemaId}:${JSON.stringify(schema)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const fn = ajv().compile(schema);
  cache.set(key, fn);
  return fn;
}

export function invalidateSchemaCache(schemaId: string): void {
  cache.delete(schemaId);
}

export function formatAjvErrors(errors: ErrorObject[] | null | undefined) {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath || e.schemaPath,
    keyword: e.keyword,
    message: e.message ?? "validation failed",
    params: e.params
  }));
}
