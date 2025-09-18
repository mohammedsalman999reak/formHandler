# Security Guide: Spam Protection (Cloudflare Turnstile)

This guide explains how the form handler uses Cloudflare Turnstile for spam protection and how to integrate it into your frontend.

## What It Does

Spam bots are a major source of abuse for online forms. This form handler integrates with Cloudflare Turnstile, a free, privacy-preserving CAPTCHA alternative, to ensure that submissions are coming from legitimate human users, not automated scripts.

## How It Works Internally

1.  **Frontend Widget**: The Turnstile widget is rendered on your website's form. It runs a series of non-intrusive challenges in the background to prove the user is human. When successful, it creates a short-lived token and injects it into a hidden form field named `cf-turnstile-response`.
2.  **Token Submission**: This token is sent to the worker along with the rest of the form data.
3.  **Token Verification**:
    - The `SecurityHelper` class takes the token and the user's IP address.
    - It makes a `POST` request to Cloudflare's verification endpoint (`https://challenges.cloudflare.com/turnstile/v2/siteverify`).
    - This request includes your `TURNSTILE_SECRET_KEY`, which proves you are the owner of the site.
    - Cloudflare's API responds with a success or failure message.
4.  **Enforcement**: If the token is valid, the request proceeds. If it is invalid, expired, or missing, the worker immediately rejects the request with a `403 Forbidden` error.

This process happens transparently for the user and provides a powerful defense against automated spam.

## Production Behavior

In production, Turnstile is a highly effective, real-time spam filter. It adds minimal latency and is far less intrusive to users than traditional CAPTCHAs. The "Invisible" widget type is recommended for the best user experience, as it will only present a visible challenge to the most suspicious traffic.

## How to Use It

### 1. Set Up Cloudflare Turnstile

1.  Go to your Cloudflare Dashboard -> Turnstile (on the left-hand sidebar).
2.  Click **"Add site"**.
3.  Give your site a name and enter its domain.
4.  Choose the **"Invisible"** widget type.
5.  Click **"Create"**.
6.  Cloudflare will provide you with a **Site Key** and a **Secret Key**.

### 2. Configure the Worker

Take the **Secret Key** from the previous step and set it as the `TURNSTILE_SECRET_KEY` in your environment variables (`.env` file or Cloudflare dashboard).

```bash
# Cloudflare Turnstile (for spam protection)
TURNSTILE_SECRET_KEY=your-turnstile-secret-key-here
```

### 3. Integrate the Widget into Your Frontend

You need to add the Turnstile script and widget to your HTML form.

1.  **Add the script** to your page's `<head>` section:
    ```html
    <script src="https://challenges.cloudflare.com/turnstile/v2/api.js" async defer></script>
    ```

2.  **Add the widget** inside your `<form>` element. Replace `your_turnstile_site_key_here` with the **Site Key** you got from the Turnstile dashboard.
    ```html
    <form id="contact-form">
      <!-- Your form fields -->
      <input type="text" name="name">
      <input type="email" name="email">

      <!-- Turnstile Widget -->
      <div class="cf-turnstile" data-sitekey="your_turnstile_site_key_here"></div>

      <button type="submit">Submit</button>
    </form>
    ```

When the user submits the form, the `FormData` object will now automatically include the `cf-turnstile-response` field, which the worker will validate. No extra JavaScript is needed to handle the token itself.
