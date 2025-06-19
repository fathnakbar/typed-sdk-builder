## Example 1: Basic Node.js Usage
This example demonstrates the core functionality of the SDKBuilder in a simple Node.js environment. It shows how to:

1. Define an endpoint configuration.
2. Instantiate the SDKBuilder.
3. Make basic GET and POST requests.
4. Handle successful responses and errors.

The example consists of two parts: a mock API server and a client script that consumes it.

## How to Run
You will need two separate terminal windows.

1. Prerequisites
First, navigate to this example's directory and install its local dependencies.

```
cd examples/01-basic-node-usage
npm install
```

2. Start the Mock API Server
In your first terminal, run the following command to start the API server. It will listen on http://localhost:4000.

```npm run start:server```

You should see the message: Mock API server running on http://localhost:4000.

3. Run the Client Script
In your second terminal, run the client script. This script will use the SDKBuilder to make requests to the server you just started.

```npm run start:client```

### Expected Output
You should see the following output logged in your client terminal, demonstrating the results of the API calls:

```
--- 1. Fetching all users... ---
✅ Success! Users loaded: [ { id: '1', name: 'Alice' }, { id: '2', name: 'Bob' } ]

--- 2. Fetching user with ID 2... ---
✅ Success! User 2 data: { id: '2', name: 'Bob' }

--- 3. Creating a new user 'Charlie'... ---
✅ Success! User created: { name: 'Charlie', email: 'charlie@example.com', id: '...' }

--- 4. Attempting to fetch a non-existent user... ---
❌ Request failed as expected with status 404.
Error message: User not found
```