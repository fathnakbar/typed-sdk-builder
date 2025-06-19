# Typed SDK Builder

[](https://www.google.com/search?q=https://www.npmjs.com/package/typed-sdk-builder)
[](https://www.google.com/search?q=https://travis-ci.com/your-username/typed-sdk-builder)
[](https://opensource.org/licenses/MIT)

A lightweight, zero-dependency TypeScript library for creating a fully-typed, configuration-based REST API client that handles authentication failures automatically, so you don't have to.

## Motivation: The "Why"

In modern web applications, interacting with a REST API often involves repetitive and error-prone boilerplate. For every API call, you might find yourself:

1.  Wrapping your `fetch` call in a `try...catch` block.
2.  Checking the response status and parsing the body.
3.  Most importantly, checking for authentication errors (like a `401 Unauthorized` status) when an access token expires.

This forces you to scatter the same authentication logic throughout your application: "Is the token invalid? Should I refresh it? Should I redirect to the login page?" This becomes tedious to maintain and violates the DRY (Don't Repeat Yourself) principle.

**This SDK Builder was created to solve that exact problem.**

The core idea is to provide a centralized, "set-it-and-forget-it" solution for API integration. You define your API endpoints *once*, and you define your authentication failure logic *once*. The builder then generates a fully-typed client. When you use this client to make a request, it will **automatically trigger your custom handler** if it detects an invalid credential response.

This means you can call any API endpoint directly without worrying about the token's validity on each call. The SDK handles the interception, letting you seamlessly redirect to a restricted page or attempt a silent token refresh, all from one place.

## Features

  * **Centralized Auth Failure Logic:** Automatically intercepts `401 Unauthorized` responses and triggers your global `onInvalidCredential` handler.
  * **Zero-Boilerplate API Calls:** Stop writing repetitive `fetch` and `try...catch` blocks. Just call the generated methods directly.
  * **Configuration-Driven:** Define all your API endpoints in a single, easy-to-read configuration object.
  * **Fully-Typed Client:** Generates a typed `fetch` client that mirrors your endpoint configuration, providing excellent autocompletion and type-safety.
  * **Automatic Payload Handling:** Intelligently handles `JSON` bodies, `FormData` for file uploads, and URL query parameters.
  * **Zero Dependencies:** Clean, modern TypeScript code with no external packages.

## Installation

```bash
npm install typed-sdk-builder
# or
yarn add typed-sdk-builder
```

## Core Usage

### 1\. Define Your Endpoints

Create a configuration object that lists all your API endpoints. **It is crucial to use `as const`** to allow TypeScript to infer the exact shape of your API for precise typing.

```typescript
// src/api/config.ts

export const endpointsConfig = {
  auth: {
    signin: { path: "/auth/signin", method: "POST" as const },
    logout: { path: "/auth/logout", method: "POST" as const },
  },
  order: {
    getDetail: { path: "/guest/order/:id", method: "GET" as const },
    create: { path: "/guest/order", method: "POST" as const },
  },
  account: {
    get: { path: "/guest/account", method: "GET" as const },
    updateProfile: { path: "/guest/account/profile", method: "POST" as const }
  }
} as const; // <-- This "as const" is the magic!
```

### 2\. Instantiate the SDK Builder

Create a new `SDKBuilder` instance. This is where you provide your base URL and, most importantly, the `onInvalidCredential` handler.

```typescript
// src/api/index.ts

import { SDKBuilder } from 'typed-sdk-builder';
import { endpointsConfig } from './config';

const PUBLIC_API_URL = "https://your-api-domain.com/api";

export const api = new SDKBuilder({
  base: PUBLIC_API_URL,
  endpoints: endpointsConfig,

  /**
   * This is the core of the automatic auth handling.
   * This function will be called automatically on any 401 response.
   */
  onInvalidCredential: (response) => {
    console.warn("Invalid credentials detected. Redirecting to login page...");
    
    // Clear any stale session data
    api.clearAllPersistentData();

    // Redirect to a restricted or login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login?session_expired=true';
    }
  },
});
```

### 3\. Use the Generated Client Directly

Now you can import and use your `api` object anywhere in your application without worrying about auth checks.

```typescript
import { api } from './api';

async function fetchAccountDetails() {
  // You can call this directly. If the token is invalid,
  // the `onInvalidCredential` handler will fire automatically and
  // the user will be redirected. No extra checks needed here.
  const accountResponse = await api.fetch.account.get();

  if (accountResponse.success) {
    console.log("Welcome back!", accountResponse.response);
  } else {
    // This part will likely not be reached on a 401 error
    // because the page will redirect first.
    console.error("Failed to fetch account:", accountResponse.response.message);
  }
}

async function login() {
    const signInResponse = await api.fetch.auth.signin({
        email: 'user@example.com',
        password: 'password123'
    });

    if (signInResponse.success) {
        // Assuming the token is in the response, store it
        api.store({ token: signInResponse.response.token });
        window.location.href = '/dashboard';
    }
}
```

## API Reference

### `SDKBuilder` Configuration

The constructor accepts a configuration object with the following properties:

| Property              | Type                                      | Required | Description                                                                                             |
| --------------------- | ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `base`                | `string`                                  | Yes      | The base URL for all API requests (e.g., `https://api.example.com/v1`).                                 |
| `endpoints`           | `EndpointsInput`                          | Yes      | The endpoint configuration object, asserted with `as const`.                                            |
| `onInvalidCredential` | `(response?) => Promise<void> \| void`    | No       | **Key Feature:** A global callback triggered on any `401 Unauthorized` response. Use this to handle session expiry and redirects. |
| `defaultHeaders`      | `Record<string, string>`                  | No       | A dictionary of headers to be sent with every request.                                                  |
| `requestTimeout`      | `number`                                  | No       | The request timeout in milliseconds. Defaults to `30000` (30 seconds).                                  |

### The Response Object (`CustomApiResponse`)

Every fetch call returns a `Promise` that resolves to a `CustomApiResponse` object:

| Property   | Type      | Description                                                                 |
| ---------- | --------- | --------------------------------------------------------------------------- |
| `success`  | `boolean` | `true` if the HTTP response status was in the 200-299 range. Same as `ok`.   |
| `ok`       | `boolean` | `true` if the HTTP response status was in the 200-299 range.                  |
| `response` | `any`     | The parsed response body (JSON or text).                                    |
| `status`   | `number`  | The HTTP status code (e.g., `200`, `401`, `404`). `0` for client-side/network errors. |

## License

This project is licensed under the MIT License.
