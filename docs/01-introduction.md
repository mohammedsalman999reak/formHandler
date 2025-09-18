# Introduction to the Cloudflare Form Handler

## What It Does

This project provides a robust, secure, and scalable backend solution for handling form submissions from any static website. Built on Cloudflare Workers, it operates at the edge, ensuring fast response times globally.

The key capabilities are:
- **Accepts form data** via a simple POST request.
- **Validates and sanitizes** all incoming data to protect against common vulnerabilities.
- **Processes submissions** by saving them to an Airtable base and/or sending an email notification via the Resend service.
- **Protects your form** from spam and abuse using modern security practices.
- **Works for multiple websites** from a single deployment, reducing code duplication and maintenance overhead.

## How It Works Internally

The system is designed with a modular and logical architecture, making it easy to understand and extend.

### Project Structure

```
.
├── src/
│   ├── index.js              # Main Cloudflare Worker entry point
│   ├── services/
│   │   ├── airtable.js       # Handles communication with the Airtable API
│   │   └── email.js          # Handles sending emails via the Resend API
│   └── utils/
│       ├── validator.js      # Logic for validating and sanitizing form data
│       ├── security.js       # Security helpers (CSRF, Turnstile, Rate Limiting, CORS)
│       └── logger.js         # Internal logging utility
├── docs/                     # Detailed documentation files
├── wrangler.toml             # Cloudflare Worker configuration file
├── package.json              # Project dependencies and scripts
└── .env                      # Local environment variables (DO NOT COMMIT)
```

### Request Flow

A typical form submission follows this sequence:

1.  **Frontend Request**: The user's browser sends a `POST` request to the worker's URL.
2.  **CORS & Method Check**: The worker first validates the request's origin (CORS) and ensures it's a `POST` request.
3.  **CSRF Protection**: It checks for a valid CSRF token to prevent cross-site request forgery attacks.
4.  **Rate Limiting**: It checks if the user's IP address has exceeded the configured request limit.
5.  **Spam Protection**: It verifies the Cloudflare Turnstile token to ensure the request is from a human.
6.  **Data Parsing & Validation**: The worker parses the JSON form data and validates it against the configured rules (e.g., required fields, data formats).
7.  **Sanitization**: All input data is sanitized to neutralize potentially malicious content (e.g., HTML encoding to prevent XSS).
8.  **Processing**: The sanitized data is passed to the configured services:
    *   `AirtableService` saves the data to your Airtable base.
    *   `EmailService` sends a notification email via Resend.
9.  **Response**: The worker returns a JSON response to the frontend indicating success or failure.

## Production Behavior

In a production environment, the worker is deployed globally across Cloudflare's network. This means:
- **Low Latency**: Requests are handled by the data center closest to the user, resulting in very fast response times.
- **High Availability**: The distributed nature of the network ensures the form handler is resilient and always available.
- **Scalability**: The worker scales automatically to handle any volume of traffic without any manual intervention.
- **Secure by Default**: All security features, like the distributed rate limiter, are fully active and protect your application at the edge.

## Initial Setup

To get started with the project, you need to have Node.js and the Wrangler CLI installed.

1.  **Clone the Repository**:
    ```bash
    git clone <repository_url>
    cd form-handler-worker
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    Copy the example environment file to create your local configuration.
    ```bash
    cp env.example .env
    ```
    You will need to fill out the variables in this `.env` file as you configure the different features. See the other documentation files for details on each variable.
