/**
 * Allowed HTTP methods for API requests.
 */
export type HTTP_METHOD = "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
/**
 * Your desired custom response structure.
 * @template DataType The expected type of the `response` field in a successful response.
 */
export type CustomApiResponse<DataType = any> = {
    success: boolean;
    ok: boolean;
    response: DataType;
    status: number;
};
/**
 * Defines the signature for a dynamically generated fetch function, returning your custom response.
 * @template TData The expected type of the `response` in the CustomApiResponse.
 */
type TypedFetchFunction<TData = any> = (idOrParamsPayload?: Record<string, any> | HTMLFormElement | string | number, directPayload?: Record<string, any> | HTMLFormElement) => Promise<CustomApiResponse<TData>>;
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
    [K in keyof TEndpointsConfig]: TEndpointsConfig[K] extends EndpointConfig ? TypedFetchFunction<any> : TEndpointsConfig[K] extends EndpointsInput ? TypedFetchClient<TEndpointsConfig[K]> : never;
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
export declare class SDKBuilder<TEndpoints extends EndpointsInput> {
    private readonly baseUrl;
    private readonly onInvalidCredential;
    private readonly defaultHeaders;
    private readonly requestTimeout;
    readonly fetch: TypedFetchClient<TEndpoints>;
    constructor(config: SDKBuilderConfig<TEndpoints>);
    private _initializeEndpoints;
    private _isActualEndpointConfig;
    private _generateFetchFunction;
    private _buildUrl;
    private _prepareRequestBodyAndHeaders;
    private _createFormDataFromObject;
    store(data: Record<string, any>): void;
    dispose(keys: string[]): void;
    clearAllPersistentData(): void;
    session(): Promise<Record<string, any>>;
    /** @deprecated */
    callback(): Promise<void>;
}
export {};
