/**
 * Security Validation Middleware
 */

export class SecurityChecks {
    isBotRequest(request) {
        const userAgent = request.headers.get('User-Agent') || '';
        const botPatterns = [
            /bot/i, /crawler/i, /spider/i, /scraper/i,
            /curl/i, /wget/i, /python/i, /java/i,
            /postman/i, /insomnia/i
        ];
        return botPatterns.some(pattern => pattern.test(userAgent));
    }

    async validateRequestSize(request, maxSize = 10 * 1024 * 1024) {
        const contentLength = request.headers.get('Content-Length');
        return !(contentLength && parseInt(contentLength) > maxSize);
    }

    getClientIP(request) {
        return request.headers.get('CF-Connecting-IP') ||
               request.headers.get('X-Forwarded-For') ||
               request.headers.get('X-Real-IP') ||
               'unknown';
    }
}
