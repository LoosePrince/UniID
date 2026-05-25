/**
 * DataNamespace — `uniid.from('post').insert/select/update/delete/ops`。
 *
 * 设计：使用 builder 风格，链式调用最后 await。
 */
import { request } from "./http";
import type { AuthNamespace } from "./auth";
import type { FieldOp, FromQueryOptions, RecordEnvelope, UniIDOptions } from "./types";

function toOrderByRecord(
  orderBy: FromQueryOptions["orderBy"]
): Record<string, "asc" | "desc"> | undefined {
  if (!orderBy) return undefined;
  const parts = Array.isArray(orderBy) ? orderBy : [orderBy];
  return parts.reduce<Record<string, "asc" | "desc">>((acc, part) => ({ ...acc, ...part }), {});
}

function buildQueryPayload(opts: FromQueryOptions): Record<string, unknown> {
  const dsl: Record<string, unknown> = {};
  if (opts.where) dsl.where = opts.where;
  if (opts.select) dsl.select = opts.select;
  const orderBy = toOrderByRecord(opts.orderBy);
  if (orderBy && Object.keys(orderBy).length > 0) dsl.orderBy = orderBy;
  if (opts.limit !== undefined) dsl.limit = opts.limit;
  if (opts.cursor) dsl.cursor = opts.cursor;
  return dsl;
}

function normalizeQueryResult<T>(raw: unknown): {
  records: RecordEnvelope<T>[];
  nextCursor?: string;
} {
  if (!raw || typeof raw !== "object") return { records: [] };
  const body = raw as { records?: unknown; items?: unknown; nextCursor?: string | null };
  const list = Array.isArray(body.records)
    ? body.records
    : Array.isArray(body.items)
      ? body.items
      : [];
  return {
    records: list as RecordEnvelope<T>[],
    nextCursor: body.nextCursor ?? undefined
  };
}

function unwrapRecord<T>(raw: unknown): RecordEnvelope<T> {
  if (raw && typeof raw === "object" && "record" in raw) {
    return (raw as { record: RecordEnvelope<T> }).record;
  }
  return raw as RecordEnvelope<T>;
}

export class FromQuery<T = unknown> {
  private opts: FromQueryOptions = {};

  constructor(
    private readonly client: DataClientInternals,
    private readonly dataType: string
  ) {}

  select(fields: string | string[]): this {
    this.opts.select = typeof fields === "string" ? [fields] : fields;
    return this;
  }
  where(filter: Record<string, unknown>): this {
    this.opts.where = filter;
    return this;
  }
  orderBy(spec: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>): this {
    this.opts.orderBy = Array.isArray(spec) ? spec : [spec];
    return this;
  }
  limit(n: number): this {
    this.opts.limit = n;
    return this;
  }
  cursor(c: string): this {
    this.opts.cursor = c;
    return this;
  }

  /** 执行查询。返回 records 列表。 */
  async run(): Promise<{ records: RecordEnvelope<T>[]; nextCursor?: string }> {
    return this.client.query<T>(this.dataType, this.opts);
  }

  /** 单条查询语义糖。 */
  async first(): Promise<RecordEnvelope<T> | null> {
    const r = await this.limit(1).run();
    return r.records[0] ?? null;
  }

  /** 写入 */
  async insert(data: Partial<T>): Promise<RecordEnvelope<T>> {
    return this.client.create<T>(this.dataType, data);
  }

  async update(recordId: string, patch: Partial<T>): Promise<RecordEnvelope<T>> {
    return this.client.update<T>(recordId, patch);
  }

  async replace(recordId: string, data: T): Promise<RecordEnvelope<T>> {
    return this.client.replace<T>(recordId, data);
  }

  async delete(recordId: string): Promise<{ id: string }> {
    return this.client.delete(recordId);
  }

  async ops(recordId: string, ops: FieldOp[]): Promise<RecordEnvelope<T>> {
    return this.client.ops<T>(recordId, ops);
  }

  async get(recordId: string): Promise<RecordEnvelope<T> | null> {
    return this.client.get<T>(recordId);
  }
}

interface DataClientInternals {
  query<T>(dataType: string, opts: FromQueryOptions): Promise<{ records: RecordEnvelope<T>[]; nextCursor?: string }>;
  create<T>(dataType: string, data: Partial<T>): Promise<RecordEnvelope<T>>;
  update<T>(recordId: string, patch: Partial<T>): Promise<RecordEnvelope<T>>;
  replace<T>(recordId: string, data: T): Promise<RecordEnvelope<T>>;
  delete(recordId: string): Promise<{ id: string }>;
  ops<T>(recordId: string, ops: FieldOp[]): Promise<RecordEnvelope<T>>;
  get<T>(recordId: string): Promise<RecordEnvelope<T> | null>;
}

export class DataNamespace implements DataClientInternals {
  constructor(
    private readonly opts: Required<Pick<UniIDOptions, "url" | "appId">>,
    private readonly auth: AuthNamespace
  ) {}

  from<T = unknown>(dataType: string): FromQuery<T> {
    return new FromQuery<T>(this, dataType);
  }

  async query<T>(dataType: string, q: FromQueryOptions): Promise<{ records: RecordEnvelope<T>[]; nextCursor?: string }> {
    await this.auth.ensureFreshToken();
    const dsl = buildQueryPayload(q);
    const raw = await request<unknown>(
      this.opts.url,
      `/api/v1/data/${encodeURIComponent(this.opts.appId)}/${encodeURIComponent(dataType)}`,
      {
        method: "GET",
        query: { q: JSON.stringify(dsl) },
        headers: this.auth.authHeader()
      }
    );
    return normalizeQueryResult<T>(raw);
  }

  async create<T>(dataType: string, data: Partial<T>): Promise<RecordEnvelope<T>> {
    await this.auth.ensureFreshToken();
    const raw = await request<unknown>(
      this.opts.url,
      `/api/v1/data/${encodeURIComponent(this.opts.appId)}/${encodeURIComponent(dataType)}`,
      {
        method: "POST",
        body: { data },
        headers: this.auth.authHeader()
      }
    );
    return unwrapRecord<T>(raw);
  }

  async update<T>(recordId: string, patch: Partial<T>): Promise<RecordEnvelope<T>> {
    await this.auth.ensureFreshToken();
    const raw = await request<unknown>(
      this.opts.url,
      `/api/v1/data/record/${encodeURIComponent(recordId)}`,
      {
        method: "PATCH",
        body: { data: patch },
        headers: this.auth.authHeader()
      }
    );
    return unwrapRecord<T>(raw);
  }

  async replace<T>(recordId: string, data: T): Promise<RecordEnvelope<T>> {
    await this.auth.ensureFreshToken();
    const raw = await request<unknown>(
      this.opts.url,
      `/api/v1/data/record/${encodeURIComponent(recordId)}`,
      {
        method: "PUT",
        body: { data },
        headers: this.auth.authHeader()
      }
    );
    return unwrapRecord<T>(raw);
  }

  async delete(recordId: string): Promise<{ id: string }> {
    await this.auth.ensureFreshToken();
    return request<{ id: string }>(this.opts.url, `/api/v1/data/record/${encodeURIComponent(recordId)}`, {
      method: "DELETE",
      headers: this.auth.authHeader()
    });
  }

  async ops<T>(recordId: string, ops: FieldOp[]): Promise<RecordEnvelope<T>> {
    await this.auth.ensureFreshToken();
    const raw = await request<unknown>(
      this.opts.url,
      `/api/v1/data/record/${encodeURIComponent(recordId)}/ops`,
      {
        method: "POST",
        body: { ops },
        headers: this.auth.authHeader()
      }
    );
    return unwrapRecord<T>(raw);
  }

  async get<T>(recordId: string): Promise<RecordEnvelope<T> | null> {
    await this.auth.ensureFreshToken();
    return request<unknown>(this.opts.url, `/api/v1/data/record/${encodeURIComponent(recordId)}`, {
      method: "GET",
      headers: this.auth.authHeader()
    })
      .then((raw) => unwrapRecord<T>(raw))
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === "DATA_RECORD_NOT_FOUND") return null;
        throw err;
      });
  }
}
