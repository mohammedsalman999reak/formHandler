/**
 * CORS Middleware
 */

export class CorsHandler {
    getHeaders(request, allowedOrigins = '*') {
        const origin = request.headers.get('Origin');
        const allowedOriginsList = allowedOrigins ? allowedOrigins.split(',').map(o => o.trim()) : ['*'];

        const isAllowedOrigin = allowedOriginsList.includes('*') ||
                               allowedOriginsList.includes(origin) ||
                               this.isSubdomainAllowed(origin, allowedOriginsList);

        return {
            'Access-Control-Allow-Origin': isAllowedOrigin ? (origin || '*') : 'null',
            'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
            'Access-Control-Max-Age': '86400',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        };
    }

    isSubdomainAllowed(origin, allowedOrigins) {
        if (!origin) return false;
        return allowedOrigins.some(allowed => {
            if (allowed === '*') return true;
            if (origin === allowed) return true;
            if (allowed.startsWith('.')) return origin.endsWith(allowed);
            return false;
        });
    }

    handlePreflight(request, allowedOrigins) {
        const headers = this.getHeaders(request, allowedOrigins);
        return new Response(null, { headers });
    }
}
