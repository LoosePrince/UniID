/**
 * FunctionsNamespace — 调用已部署的函数。
 */
import { request } from "./http";
import type { AuthNamespace } from "./auth";
import type { UniIDOptions } from "./types";

export class FunctionsNamespace {
  constructor(
    private readonly opts: Required<Pick<UniIDOptions, "url" | "appId">>,
    private readonly auth: AuthNamespace
  ) {}

  async invoke<TResult = unknown>(fnName: string, payload?: unknown): Promise<TResult> {
    await this.auth.ensureFreshToken();
    const res = await request<{ output: TResult }>(this.opts.url, `/api/v1/functions/${encodeURIComponent(fnName)}/invoke`, {
      method: "POST",
      body: { payload },
      headers: this.auth.authHeader()
    });
    return res.output;
  }
}
