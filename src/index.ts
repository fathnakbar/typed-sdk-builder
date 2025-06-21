// --- Core Type Definitions ---

/**
 * Allowed HTTP methods for API requests.
 */
export type HTTP_METHOD = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";

/**
 * Your desired custom response structure.
 * @template DataType The expected type of the `response` field in a successful response.
 */
export type CustomApiResponse<DataType = any> = {
  success: boolean; // Mirrors 'ok' for convenience
  ok: boolean;
  response: DataType;
  status: number;
};

/**
 * Defines the signature for a dynamically generated fetch function, returning your custom response.
 * @template TData The expected type of the `response` in the CustomApiResponse.
 */
type TypedFetchFunction<TData = any> = (
  idOrParamsPayload?: Record<string, any> | HTMLFormElement | string | number,
  directPayload?: Record<string, any> | HTMLFormElement
) => Promise<CustomApiResponse<TData>>;

/**
 * Configuration for a single API endpoint.
 */
export type EndpointConfig = {
  path: string;
  method: HTTP_METHOD;
};

/**
 * Structure for the endpoints configuration object, allowing nested groups.
 */
export type EndpointsInput = {
  [key: string]: EndpointConfig | EndpointsInput;
};

/**
 * Mapped type for the `fetch` object, ensuring each endpoint key maps to a TypedFetchFunction.
 * @template TEndpointsConfig The type of the specific endpoints configuration object.
 */
export type TypedFetchClient<TEndpointsConfig extends EndpointsInput> = {
  [K in keyof TEndpointsConfig]: TEndpointsConfig[K] extends EndpointConfig
    ? TypedFetchFunction<any> // `response` field will be `any` by default.
                                // For specific data types per endpoint, a more complex "DataTypeMap" approach is needed.
    : TEndpointsConfig[K] extends EndpointsInput
    ? TypedFetchClient<TEndpointsConfig[K]> // Handle nested endpoint structures
    : never;
};

/**
 * Configuration for the SDKBuilder.
 * @template TEndpoints The type of the specific endpoints configuration object.
 */
export interface SDKBuilderConfig<TEndpoints extends EndpointsInput = EndpointsInput> {
  base: string;
  endpoints: TEndpoints;
  onInvalidCredential?: (response?: CustomApiResponse<any>) => Promise<void> | void;
  defaultHeaders?: Record<string, string>;
  requestTimeout?: number;
}

// --- SDKBuilder Class ---

export class SDKBuilder<TEndpoints extends EndpointsInput> {
  private readonly baseUrl: URL;
  private readonly onInvalidCredential: (response?: CustomApiResponse<any>) => Promise<void> | void;
  private readonly defaultHeaders: Record<string, string>;
  private readonly requestTimeout: number;

  public readonly fetch: TypedFetchClient<TEndpoints>;

  constructor(config: SDKBuilderConfig<TEndpoints>) {
    if (!config.base) {
      throw new Error("[SDKBuilder] 'base' URL configuration is required.");
    }
    this.baseUrl = new URL(config.base);
    this.onInvalidCredential = config.onInvalidCredential || (() => Promise.resolve());
    this.defaultHeaders = config.defaultHeaders || { 'Accept': 'application/json' };
    if (!this.defaultHeaders['Accept']) { // Ensure Accept header if not provided
        this.defaultHeaders['Accept'] = 'application/json';
    }
    this.requestTimeout = config.requestTimeout || 30000;

    this.fetch = {} as TypedFetchClient<TEndpoints>; // Initialize with type assertion
    this._initializeEndpoints(config.endpoints, this.fetch);
  }

  private _initializeEndpoints(
    endpointsConfig: EndpointsInput,
    currentObjectBranch: any, // Using 'any' for recursive assignment simplicity
    parentKeyPath: string = ""
  ): void {
    Object.entries(endpointsConfig).forEach(([key, configValue]) => {
      const currentPath = parentKeyPath ? `${parentKeyPath}.${key}` : key;
      if (this._isActualEndpointConfig(configValue)) {
        currentObjectBranch[key] = this._generateFetchFunction(configValue, currentPath);
      } else if (typeof configValue === 'object' && configValue !== null) {
        currentObjectBranch[key] = currentObjectBranch[key] || {};
        this._initializeEndpoints(configValue, currentObjectBranch[key], currentPath);
      } else {
        console.warn(`[SDKBuilder] Invalid configuration for endpoint key: ${currentPath}. Expected an object or EndpointConfig.`);
      }
    });
  }

  private _isActualEndpointConfig(config: EndpointConfig | EndpointsInput): config is EndpointConfig {
    return typeof (config as EndpointConfig).path === 'string' &&
           typeof (config as EndpointConfig).method === 'string';
  }

  private _generateFetchFunction<TData = any>(
    endpointConfig: EndpointConfig,
    debugPath: string
  ): TypedFetchFunction<TData> {
    return async (
      idOrParamsPayload?: Record<string, any> | string | number,
      directPayload?: Record<string, any>
    ): Promise<CustomApiResponse<TData>> => {
      let pathParamsSource: Record<string, any> | string | number | undefined;
      let payloadSource: Record<string, any> | undefined;

      // Determine how arguments were passed
      if (directPayload !== undefined) {
        pathParamsSource = idOrParamsPayload as (Record<string, any> | string | number);
        payloadSource = directPayload;
      } else if (typeof idOrParamsPayload === 'object' && idOrParamsPayload !== null && !(idOrParamsPayload instanceof HTMLFormElement)) {
        const singleArgObject = { ...idOrParamsPayload };
        // Check for special '$params' key for path parameters
        if (singleArgObject.$params && typeof singleArgObject.$params === 'object') {
          pathParamsSource = singleArgObject.$params as Record<string, any>;
          Object.entries(pathParamsSource).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              throw new Error(`Path parameter '${key}' in $params cannot be an object. Received: ${JSON.stringify(value)}`);
            }
          });
          delete singleArgObject.$params;
        }
        payloadSource = singleArgObject;
      } else {
        pathParamsSource = idOrParamsPayload as string | number | undefined;
        payloadSource = undefined;
      }

      const { url } = this._buildUrl(endpointConfig, pathParamsSource);
      const { body, headers: requestSpecificHeaders } = this._prepareRequestBodyAndHeaders(
        endpointConfig.method,
        url,
        payloadSource
      );

      const requestHeaders = new Headers(this.defaultHeaders);
      Object.entries(requestSpecificHeaders).forEach(([name, value]) => requestHeaders.set(name, value));

      const sessionData = await this.session();
      const token = sessionData?.token || sessionData?.access_token;
      if (token && typeof token === 'string') {
        requestHeaders.set('Authorization', `Bearer ${token}`);
      }

      try {
        const httpResponse = await fetch(url.href, {
          method: endpointConfig.method,
          headers: requestHeaders,
          body,
          signal: AbortSignal.timeout(this.requestTimeout),
          credentials: 'include',
        });

        let responseData: any = null;
        const contentType = httpResponse.headers.get('content-type');
        if (httpResponse.status !== 204 && httpResponse.body) {
          if (contentType?.includes('application/json')) {
            responseData = await httpResponse.json().catch(() => null);
          } else if (contentType?.includes('text/')) {
            responseData = await httpResponse.text().catch(() => null);
          }
        }

        // Normalize error message if possible
        if (responseData && typeof responseData === 'object' && responseData.error?.message && responseData.message === undefined) {
          responseData.message = responseData.error.message;
        }

        const result: CustomApiResponse<TData> = {
          success: httpResponse.ok,
          ok: httpResponse.ok,
          response: responseData as TData,
          status: httpResponse.status,
        };

        if (result.status === 401) { // Check for 401 specifically
          await this.onInvalidCredential(result);
        }
        return result;

      } catch (error: any) {
        console.error(`[SDKBuilder] Network/operational error for ${debugPath} (${endpointConfig.method} ${url.pathname}):`, error);
        const errorIsTimeout = error.name === 'TimeoutError';
        return {
          success: false,
          ok: false,
          response: {
            message: errorIsTimeout ? 'Request timed out' : (error.message || 'A client-side error occurred.'),
            errorDetails: error,
          } as any, // TData is for successful responses
          status: 0, // Indicates client-side/network error
        };
      }
    };
  }

  private _buildUrl(
    endpointConfig: EndpointConfig,
    pathParamsSource?: Record<string, any> | string | number
  ): { url: URL } {
    const url = new URL(this.baseUrl.toString());
    const baseP = this.baseUrl.pathname.replace(/\/$/, "");
    const endpointP = endpointConfig.path.replace(/^\//, "");
    url.pathname = `${baseP}/${endpointP}`;
    let tempPath = url.pathname;

    if (pathParamsSource !== undefined && pathParamsSource !== null) {
      if (typeof pathParamsSource === 'string' || typeof pathParamsSource === 'number') {
        // Replace the first placeholder found
        const singleParamMatch = tempPath.match(/:\w+/);
        if (singleParamMatch) {
          tempPath = tempPath.replace(singleParamMatch[0], encodeURIComponent(String(pathParamsSource)));
        }
      } else if (typeof pathParamsSource === 'object') {
        // Replace named placeholders
        Object.entries(pathParamsSource).forEach(([key, value]) => {
          const placeholder = `:${key}`;
          if (tempPath.includes(placeholder)) {
            tempPath = tempPath.replace(new RegExp(placeholder, 'g'), encodeURIComponent(String(value ?? '')));
          }
        });
      }
    }
    url.pathname = tempPath;
    return { url };
  }

  private _prepareRequestBodyAndHeaders(
    method: HTTP_METHOD,
    url: URL,
    payloadSource?: Record<string, any>
  ): { body?: BodyInit; headers: Record<string, string> } {
    const headers: Record<string, string> = {};
    let body: BodyInit | undefined;

    // For GET/DELETE, payload is for query params. For other methods, it's the body.
    if (!payloadSource) {
        return { body: undefined, headers };
    }

    if (method === "GET" || method === "DELETE") {
      if (typeof payloadSource === 'object') {
        Object.entries(payloadSource).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            if (Array.isArray(val)) {
              val.forEach(vItem => { if (vItem !== null) url.searchParams.append(key, String(vItem))});
            } else {
              url.searchParams.append(key, String(val));
            }
          }
        });
      }
      return { body: undefined, headers };
    }

    // Handle body for POST, PUT, PATCH
    if (payloadSource instanceof HTMLFormElement) {
        const form = payloadSource;
        const isMultipart = form.enctype === 'multipart/form-data' ||
                              Array.from(form.elements).some(el => (el as HTMLInputElement).type === 'file' && (el as HTMLInputElement).files && (el as HTMLInputElement).files!.length > 0);
        if (isMultipart) {
            body = new FormData(form);
        } else {
            // Convert standard form to JSON
            const formObject: Record<string, any> = {};
            new FormData(form).forEach((value, key) => {
                if (formObject.hasOwnProperty(key)) {
                    if (!Array.isArray(formObject[key])) formObject[key] = [formObject[key]];
                    formObject[key].push(value);
                } else {
                    formObject[key] = value;
                }
            });
            body = JSON.stringify(formObject);
            headers['Content-Type'] = 'application/json';
        }
    } else if (typeof payloadSource === 'object') {
      const hasFiles = Object.values(payloadSource).some(
        value => value instanceof File || (Array.isArray(value) && value.some(v => v instanceof File))
      );
      if (hasFiles) {
        body = this._createFormDataFromObject(payloadSource);
        // 'Content-Type' for multipart/form-data is set by the browser
      } else {
        body = JSON.stringify(payloadSource);
        headers['Content-Type'] = 'application/json';
      }
    } else if (typeof payloadSource === 'string') {
        // Advanced case: user provides a raw string body
        body = payloadSource;
        try {
            JSON.parse(payloadSource);
            headers['Content-Type'] = 'application/json'; // Assume JSON if parsable
        } catch (e) { /* Not JSON, could be text/xml, etc. User should set header manually if needed */ }
    }
    return { body, headers };
  }

  private _createFormDataFromObject(obj: Record<string, any>, formData: FormData = new FormData(), parentKey?: string): FormData {
    Object.entries(obj).forEach(([key, value]) => {
      const currentKey = parentKey ? `${parentKey}[${key}]` : key;
      if (value instanceof File) {
        formData.append(currentKey, value);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          const arrayKey = `${currentKey}[${index}]`;
          if (typeof item === 'object' && item !== null && !(item instanceof File)) {
            this._createFormDataFromObject(item, formData, arrayKey);
          } else if (item !== undefined && item !== null) {
            formData.append(arrayKey, item instanceof File ? item : String(item));
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        this._createFormDataFromObject(value, formData, currentKey);
      } else if (value !== undefined && value !== null) {
        formData.append(currentKey, String(value));
      }
    });
    return formData;
  }

  public store(data: Record<string, any>): void {
    if (typeof localStorage === 'undefined') return;
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    });
  }

  public dispose(keys: string[]): void {
    if (typeof localStorage === 'undefined') return;
    keys.forEach(key => localStorage.removeItem(key));
  }

  public clearAllPersistentData(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.clear();
  }

  public async session(): Promise<Record<string, any>> {
    if (typeof localStorage === 'undefined') {
      return Promise.resolve({});
    }
    const sessionData: Record<string, any> = {};
    // Common session/token keys to look for. Customize as needed.
    // const keysToFetch = ['token', 'access_token', 'user_data', 'sessionToken', 'refreshToken'];
    for (let i = 0;i < localStorage.length;i++) {
      const key = localStorage.key(i)
      if(key == null) continue
      const item = localStorage.getItem(key);
      if (item !== null) {
        try { sessionData[key] = JSON.parse(item); }
        catch (e) { sessionData[key] = item; }
      }
    }
    return Promise.resolve(sessionData);
  }

  /** @deprecated */
  public async callback(): Promise<void> {
    console.warn("[SDKBuilder] The 'callback' method is deprecated. Use async/await or .then()/.catch() on fetch calls instead.");
    throw new Error("The 'callback' method is deprecated.");
  }
}