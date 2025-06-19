// Important: This assumes your 'examples' directory is at the root of your project,
// alongside the 'src' directory where the SDKBuilder source lives.
import { SDKBuilder } from '../../src/index';

// 1. Define the endpoints configuration. This must match the mock API.
const endpointsConfig = {
  users: {
    getAll: { path: '/users', method: 'GET' as const },
    getById: { path: '/users/:id', method: 'GET' as const },
    create: { path: '/users', method: 'POST' as const },
  },
} as const; // "as const" is crucial for typing!

// 2. Instantiate the SDK, pointing to the mock API server.
const api = new SDKBuilder({
  base: 'http://localhost:4000',
  endpoints: endpointsConfig,
});

// 3. Create an async function to run the examples.
async function main() {
  console.log('--- 1. Fetching all users... ---');
  const allUsersResponse = await api.fetch.users.getAll();
  if (allUsersResponse.success) {
    console.log('✅ Success! Users loaded:', allUsersResponse.response);
  } else {
    console.error('❌ Failed to load users:', allUsersResponse.response);
  }

  console.log('\n--- 2. Fetching user with ID 2... ---');
  const singleUserResponse = await api.fetch.users.getById('2'); // Pass ID directly
  if (singleUserResponse.success) {
    console.log('✅ Success! User 2 data:', singleUserResponse.response);
  } else {
    console.error('❌ Failed to load user 2:', singleUserResponse.response);
  }

  console.log("\n--- 3. Creating a new user 'Charlie'... ---");
  const newUserPayload = {
    name: 'Charlie',
    email: 'charlie@example.com',
  };
  const createUserResponse = await api.fetch.users.create(newUserPayload);
  if (createUserResponse.success) {
    console.log('✅ Success! User created:', createUserResponse.response);
  } else {
    console.error('❌ Failed to create user:', createUserResponse.response);
  }

  console.log('\n--- 4. Attempting to fetch a non-existent user... ---');
  const badUserResponse = await api.fetch.users.getById('99'); // This ID does not exist
  if (!badUserResponse.success) {
    console.log(
      `❌ Request failed as expected with status ${badUserResponse.status}.`
    );
    console.log('Error message:', badUserResponse.response.message);
  } else {
    console.log('This should not have succeeded!');
  }
}

// Run the main function
main().catch(error => {
  console.error("\nAn unexpected error occurred:", error.message);
  console.log("Is the mock API server running? (npm run start:server)");
});

