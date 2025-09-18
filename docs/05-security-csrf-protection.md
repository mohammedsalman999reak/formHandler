# Security Guide: CSRF Protection

This guide explains the Cross-Site Request Forgery (CSRF) protection implemented in the form handler and how to interact with it from your frontend.

## What It Does

CSRF is an attack where a malicious site tricks a user's browser into making an unintended request to another site where the user is authenticated. Our form handler implements the **Double-Submit Cookie** pattern to prevent this.

This feature ensures that form submissions are intentionally sent from your actual website, not from a malicious third-party site.

## How It Works Internally

This is a stateless CSRF protection mechanism, which is ideal for a serverless environment like Cloudflare Workers.

1.  **Token Issuance**:
    - The frontend makes a `GET` request to the `/csrf-token` endpoint of the worker.
    - The `SecurityHelper` class generates a cryptographically strong, random token.
    - The worker sends this token back to the client in two places:
        1.  **In a `Set-Cookie` header**: The cookie (`__Host-csrf-token`) is `HttpOnly` (inaccessible to JavaScript), `Secure` (sent only over HTTPS), and `SameSite=Strict` (sent only for same-site requests). This is the most secure way to store the token on the client.
        2.  **In the JSON response body**: The same token is sent in the response payload so the frontend JavaScript can read it.

2.  **Token Validation**:
    - When the frontend submits the form (`POST` request), it must include the token it received in the JSON payload as a custom HTTP header (`X-CSRF-Token`).
    - The browser automatically includes the `__Host-csrf-token` cookie with the request.
    - The worker then compares the token from the `X-CSRF-Token` header with the token from the cookie.
    - **If they match**, the request is considered legitimate and is allowed to proceed.
    - **If they do not match** (or if either is missing), the request is rejected with a `403 Forbidden` error.

Because a malicious site cannot read the `HttpOnly` cookie and cannot guess the random token value, it is unable to forge a valid request.

## Production Behavior

This feature is always active in production and requires no special configuration other than correct frontend implementation. It adds a negligible amount of latency to the submission process (one extra round trip to fetch the token) but provides a critical layer of security.

## How to Use It (Frontend Implementation)

Your frontend code must be updated to follow the token flow.

### Step 1: Fetch the CSRF Token

Before submitting the form, you must first make a `GET` request to your worker's `/csrf-token` endpoint.

```javascript
const workerUrl = 'https://your-worker.your-subdomain.workers.dev';

async function getCsrfToken() {
  const response = await fetch(`${workerUrl}/csrf-token`);
  const { csrfToken } = await response.json();
  return csrfToken;
}
```

### Step 2: Submit the Form with the Token

When you send the `POST` request to submit the form, you must include the token you received in the `X-CSRF-Token` header.

```javascript
async function submitForm(formData, csrfToken) {
  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken // <-- Crucial step
    },
    body: JSON.stringify(formData)
  });
  return response.json();
}
```

### Example: Full Form Submission Handler

```javascript
const form = document.getElementById('contact-form');
const workerUrl = 'https://your-worker.your-subdomain.workers.dev';

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    // 1. Fetch CSRF token first
    const csrfResponse = await fetch(`${workerUrl}/csrf-token`);
    const { csrfToken } = await csrfResponse.json();

    if (!csrfToken) {
      throw new Error('Could not retrieve CSRF token.');
    }

    // 2. Gather form data (including Turnstile response)
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    // 3. Submit the form with the token
    const result = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify(data)
    }).then(res => res.json());

    if (result.success) {
      alert('Message sent!');
      form.reset();
    } else {
      alert(`Error: ${result.error}`);
    }

  } catch (error) {
    console.error('Submission error:', error);
    alert('An error occurred.');
  }
});
```
This ensures that every form submission is protected against CSRF attacks.
