/**
 * The shape of one outbound HTTP call and of what it returned.
 *
 * These are plain structural interfaces — they carry no nominal risk the way
 * `DslError` does. They live here because every generated package that emits an
 * HTTP step repeats them verbatim in its own `.d.ts` for no reason.
 *
 * The `fetch` implementation that reads them stays inside the generated
 * packages: transport is per-bundle by decision.
 */

export interface HttpAuth {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  scheme?: 'basic' | 'bearer';
  in?: 'header' | 'query' | 'cookie';
  name?: string;
  value?: string;
  username?: string;
  password?: string;
  token?: string;
}

export interface HttpRequest<TBody> {
  url: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: TBody;
  auth?: HttpAuth;
  timeout?: number;
}

/**
 * What one HTTP call returned. `body` is the response text exactly as it
 * arrived — a typed body is what the step's declared response schemas are for,
 * and those are decoded through `parseResponse`.
 */
export interface HttpTextResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}
