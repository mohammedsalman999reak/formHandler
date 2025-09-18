/**
 * Next.js API Route for Form Handler Integration
 * 
 * This example shows how to integrate the Cloudflare Workers form handler
 * with a Next.js application using API routes as a proxy.
 */

// pages/api/contact.js or app/api/contact/route.js

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Configuration
    const WORKER_URL = process.env.FORM_HANDLER_WORKER_URL;
    const API_KEY = process.env.FORM_HANDLER_API_KEY;

    if (!WORKER_URL) {
      throw new Error('FORM_HANDLER_WORKER_URL environment variable is required');
    }

    // Prepare headers for the worker request
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add API key if configured
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    // Forward the request to the Cloudflare Worker
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Return the response from the worker
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Form submission error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// Handle preflight requests
export async function OPTIONS(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
}

/**
 * Next.js App Router version (app/api/contact/route.js)
 * 
 * If you're using the App Router, use this instead:
 */

/*
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const WORKER_URL = process.env.FORM_HANDLER_WORKER_URL;
    const API_KEY = process.env.FORM_HANDLER_API_KEY;

    if (!WORKER_URL) {
      throw new Error('FORM_HANDLER_WORKER_URL environment variable is required');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error('Form submission error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
*/

/**
 * React Hook for Form Submission
 * 
 * Create a custom hook for easy form handling:
 */

import { useState } from 'react';

export function useFormSubmission() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submitForm = async (formData) => {
    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        return data;
      } else {
        setError(data.error || 'An error occurred');
        return null;
      }

    } catch (err) {
      setError('Network error. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    submitForm,
    isLoading,
    error,
    success,
    clearError: () => setError(''),
    clearSuccess: () => setSuccess(false),
  };
}

/**
 * Example Usage in a React Component
 */

/*
import { useFormSubmission } from '../hooks/useFormSubmission';

export default function ContactForm() {
  const { submitForm, isLoading, error, success } = useFormSubmission();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitForm(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="name"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        required
      />
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required
      />
      <textarea
        name="message"
        value={formData.message}
        onChange={(e) => setFormData({...formData, message: e.target.value})}
        required
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send Message'}
      </button>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">Message sent successfully!</div>}
    </form>
  );
}
*/

/**
 * Environment Variables for Next.js
 * 
 * Add these to your .env.local file:
 * 
 * FORM_HANDLER_WORKER_URL=https://your-worker.your-subdomain.workers.dev
 * FORM_HANDLER_API_KEY=your-api-key-here (optional)
 */
