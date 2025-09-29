/**
 * Authentication Middleware
 */

export class AuthHandler {
    validateApiKey(request, expectedApiKey) {
        if (!expectedApiKey) return true;

        const apiKey = request.headers.get('X-API-Key') ||
                      request.headers.get('Authorization')?.replace('Bearer ', '');
        return apiKey === expectedApiKey;
    }

    validateOrigin(request, allowedOrigins) {
        const origin = request.headers.get('Origin');
        if (!origin) return false;

        const allowedOriginsList = allowedOrigins ? allowedOrigins.split(',').map(o => o.trim()) : [];
        if (allowedOriginsList.includes('*')) return true;
        if (allowedOriginsList.includes(origin)) return true;

        // Subdomain check
        return allowedOriginsList.some(allowed =>
            allowed.startsWith('.') ? origin.endsWith(allowed) : false
        );
    }
}
