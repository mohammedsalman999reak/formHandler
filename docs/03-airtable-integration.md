# Airtable Integration Guide

This guide explains how to configure the form handler to save submissions to an Airtable base.

## What It Does

The Airtable integration allows you to automatically store every valid form submission as a new record in a specified Airtable table. This creates a powerful, spreadsheet-like database of all your contacts and messages, which you can then use for analytics, marketing, or other business processes.

## How It Works Internally

When a form submission is successfully validated, the `AirtableService` in `src/services/airtable.js` is triggered.

1.  **Configuration Check**: It first checks if the `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` environment variables are present. If not, the service is skipped.
2.  **Data Mapping**: It maps the sanitized form data to a structure that matches the expected fields in your Airtable table. The default mapping is:
    - `Name` -> `formData.name`
    - `Email` -> `formData.email`
    - `Message` -> `formData.message`
    - `Timestamp` -> The submission timestamp.
    - `IP Address` -> The submitter's IP address.
    - `Origin` -> The website the form was submitted from.
3.  **API Request**: It sends the data to the Airtable API via a `POST` request.
4.  **Retry Logic**: If the request fails due to a network or server error, the service will automatically retry the request up to 3 times with exponential backoff to improve reliability.
5.  **Error Handling**: If the Airtable API returns an error (e.g., invalid API key, wrong base ID), the error is caught gracefully, logged, and the form submission process continues with any other configured services (like email).

## Production Behavior

In production, the service behaves just as described above. Since it includes retry logic, it is resilient to transient network issues between Cloudflare and Airtable. If Airtable's API is down or misconfigured, the form handler will still succeed if another service (like email) is enabled and succeeds.

## How to Use It

### 1. Set Up Your Airtable Base

1.  Create a new base in your Airtable workspace.
2.  Create a table. You can name it anything, but `Form_Submissions` is the default.
3.  Add the following fields to your table with the specified field types:
    - `Name` (Single line text)
    - `Email` (Email)
    - `Message` (Long text)
    - `Timestamp` (Date - with "Use the same time zone for all collaborators" enabled)
    - `IP Address` (Single line text)
    - `Origin` (Single line text)

### 2. Get Your Airtable Credentials

1.  **Base ID**:
    - Go to your Airtable base.
    - Click on the "Help" menu in the top right corner.
    - Click "API documentation".
    - Your Base ID (a string starting with `app...`) will be listed in the introduction section.
2.  **API Key (Personal Access Token)**:
    - Go to your Airtable Account page: `https://airtable.com/account`.
    - Go to the "Developer hub" section.
    - Create a new **Personal Access Token**.
    - Grant it the following scopes:
        - `data.records:read`
        - `data.records:write`
    - Grant it access to the base you just created.
    - Copy the generated token.

### 3. Set Environment Variables

Add the credentials you just gathered to your environment variables (`.env` file or Cloudflare dashboard):

```bash
# Airtable Configuration
AIRTABLE_API_KEY=your_personal_access_token_here
AIRTABLE_BASE_ID=your_base_id_here
AIRTABLE_TABLE_NAME=Form_Submissions # Optional: change if you used a different name
```

The Airtable integration is now active. Any successful form submission will automatically create a new record in your table.
