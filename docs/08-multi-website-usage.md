# Multi-Website Usage Guide

This guide explains how to use a single deployment of the form handler to serve forms on multiple different websites or domains.

## What It Does

The form handler is designed to be a centralized service. Instead of deploying a separate worker for each of your websites, you can deploy a single worker and have all your sites send their form submissions to it. This significantly reduces maintenance, simplifies configuration, and lowers costs.

## How It Works Internally

The system uses two key mechanisms to support multiple websites:

1.  **CORS (Cross-Origin Resource Sharing)**: The worker uses a configurable allow-list of domains (`ALLOWED_ORIGINS`). When a request comes in, the worker checks the `Origin` header sent by the browser. If the origin is in the allow-list, the request is processed. If not, it is rejected. This is the primary security mechanism that ensures only your websites can access the form handler.

2.  **Origin Tracking**: For every valid submission, the worker captures the `Origin` header and saves it along with the form data. This allows you to easily identify which website a submission came from. You can see this in the "Origin" column of your Airtable base.

## Production Behavior

In production, you can have dozens or even hundreds of websites all pointing to the same worker endpoint. The worker will scale automatically to handle the combined traffic. By inspecting the `Origin` field in your Airtable base, you can filter, sort, and analyze submissions by which website they originated from.

## How to Use It

### Step 1: Configure Allowed Origins

This is the most important step for enabling multi-website support.

In your environment variables (`.env` file or Cloudflare dashboard), set the `ALLOWED_ORIGINS` variable to a comma-separated list of all the domains you want to allow.

**Do not use wildcards (`*`) in production if you want to restrict access to your sites only.**

```bash
# Allow submissions from mysite.com and my-other-cool-site.org
ALLOWED_ORIGINS=https://mysite.com,https://my-other-cool-site.org
```

**Note**: You must include the full protocol (`https://`). The system does not support subdomains with wildcards (e.g., `*.yourdomain.com`). You must list each subdomain explicitly.

### Step 2: Point Your Websites to the Worker

On each of your websites, update your frontend code to point to the **same worker URL**.

For example, if your worker is at `https://form-handler.your-account.workers.dev`, the code on `mysite.com` would look like this:

```javascript
// On mysite.com
const workerUrl = 'https://form-handler.your-account.workers.dev';
// ... your fetch logic ...
```

And the code on `my-other-cool-site.org` would be identical:

```javascript
// On my-other-cool-site.org
const workerUrl = 'https://form-handler.your-account.workers.dev';
// ... your fetch logic ...
```

### Step 3: Differentiate Submissions (Optional)

If you need to handle submissions from different sites differently (e.g., save them to different Airtable tables or send emails to different people), you have two main options:

#### Option A: Add a Hidden Field

Add a hidden input field to each form to identify the site.

```html
<!-- On mysite.com -->
<input type="hidden" name="site_identifier" value="main_site">

<!-- On my-other-cool-site.org -->
<input type="hidden" name="site_identifier" value="secondary_blog">
```

You would then need to modify the worker code (`src/index.js`) to read this `site_identifier` field and apply different logic based on its value.

#### Option B: Deploy Separate Workers

If your logic is significantly different for each site, it may be simpler to deploy separate instances of the worker for each one, each with its own environment variables. You can manage this with different environments in your `wrangler.toml` file. This approach provides better separation but requires more management.

For most use cases, the single-worker approach is sufficient and recommended.
