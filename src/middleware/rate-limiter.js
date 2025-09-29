/**
 * Rate Limiting Middleware
 */

export class RateLimiter {
    async check(request, env) {
        if (!env.RATE_LIMITER) {
            console.warn('RATE_LIMITER KV namespace not found. Skipping rate limiting.');
            return { allowed: true, remaining: -1, resetTime: -1 };
        }

        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitPerMinute = parseInt(env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 60;
        const now = Date.now();
        const windowMs = 60 * 1000;

        const kvData = await env.RATE_LIMITER.get(ip, { type: 'json' });
        const timestamps = kvData || [];
        const recentTimestamps = timestamps.filter(timestamp => now - timestamp < windowMs);

        if (recentTimestamps.length >= rateLimitPerMinute) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: recentTimestamps[0] ? recentTimestamps[0] + windowMs : now + windowMs
            };
        }

        const newTimestamps = [...recentTimestamps, now];
        await env.RATE_LIMITER.put(ip, JSON.stringify(newTimestamps), {
            expirationTtl: windowMs / 1000
        });

        return {
            allowed: true,
            remaining: rateLimitPerMinute - newTimestamps.length,
            resetTime: now + windowMs
        };
    }
}
