# Security Guide: Rate Limiting

This guide explains how the form handler implements distributed rate limiting to protect against abuse.

## What It Does

Rate limiting prevents a single user (identified by their IP address) from submitting the form too many times in a short period. This is a crucial defense against various types of abuse, including:
- Malicious bots attempting to flood your inbox or database.
- A single user repeatedly submitting the form, whether intentionally or by accident.
- Simple denial-of-service attacks.

## How It Works Internally

The rate limiting logic is handled by the `SecurityHelper` class and leverages Cloudflare's infrastructure for distributed storage.

1.  **IP Address Identification**: The worker identifies the user by their `CF-Connecting-IP` header, which is reliably provided by the Cloudflare network.
2.  **KV Storage**: The system uses a **Cloudflare KV namespace** (which you must bind with the name `RATE_LIMITER`) to store request timestamps for each IP address. Using KV is essential because it provides a single source of truth across all of Cloudflare's global data centers. An in-memory solution would not work, as each data center would have its own separate, inconsistent count.
3.  **Timestamp Tracking**:
    - When a request comes in, the worker fetches the list of recent request timestamps for that IP from KV.
    - It filters out any timestamps that are older than the configured time window (e.g., the last 60 seconds).
    - It checks if the count of remaining timestamps is at or above the configured limit.
4.  **Enforcement**:
    - If the limit is exceeded, the request is rejected with a `429 Too Many Requests` error.
    - If the limit is not exceeded, the current timestamp is added to the list, and the updated list is written back to KV.
5.  **Automatic Expiration**: To prevent the KV store from growing indefinitely, each IP address key is set to expire automatically after the time window has passed. This is an efficient, self-cleaning mechanism.

## Production Behavior

In production, this feature provides robust, distributed protection. A user's request count is accurately tracked no matter which Cloudflare data center handles their request. If a user hits the rate limit, they will be blocked for the remainder of the time window and will be able to submit again once the window has passed.

## How to Use It

### 1. Create and Bind the KV Namespace

This is a **required setup step**.

1.  Open your terminal and run the following Wrangler command to create a new KV namespace:
    ```bash
    wrangler kv:namespace create "RATE_LIMITER"
    ```
2.  Wrangler will give you a configuration snippet. Copy this and paste it into your `wrangler.toml` file. It will look like this:
    ```toml
    [[kv_namespaces]]
    binding = "RATE_LIMITER"
    id = "your_kv_id_here"
    preview_id = "your_preview_kv_id_here"
    ```

### 2. Configure the Rate Limit (Optional)

You can control the rate limit by setting an environment variable. If you don't set it, a sensible default is used.

- `RATE_LIMIT_REQUESTS_PER_MINUTE`: The number of submissions allowed per IP per minute. Defaults to `60`.

Add this to your `.env` file or set it in the Cloudflare dashboard:

```bash
# Optional: Set a custom rate limit
RATE_LIMIT_REQUESTS_PER_MINUTE=20 # Allow 20 requests per minute
```

Once the KV namespace is bound, the rate limiter is active automatically. No frontend changes are required.
