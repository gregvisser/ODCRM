/**
 * Rate Limiting Middleware for ODCRM API
 * Added: 2026-02-24 (Audit Fix)
 * 
 * Protects API endpoints from abuse and DoS attacks.
 * Uses in-memory store (for single-instance deployments).
 * For multi-instance deployments, consider Redis-based store.
 */

import type { Request, Response, NextFunction } from 'express'

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Maximum requests per window
  message?: string      // Custom error message
  keyGenerator?: (req: Request) => string  // Custom key generator
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

/**
 * Default key generator - uses IP address
 */
const defaultKeyGenerator = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket.remoteAddress || 'unknown'
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = defaultKeyGenerator
  } = config

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req)
    const now = Date.now()
    
    let entry = rateLimitStore.get(key)
    
    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime: now + windowMs
      }
      rateLimitStore.set(key, entry)
    } else {
      // Increment existing entry
      entry.count++
    }
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString())
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString())
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString())
    
    if (entry.count > maxRequests) {
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      })
      return
    }
    
    next()
  }
}

/**
 * Pre-configured rate limiters for different use cases
 */

// General API rate limiter - 100 requests per minute
export const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many API requests. Please wait a moment before trying again.'
})

// Strict rate limiter for sensitive operations - 10 requests per minute
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Rate limit exceeded for this operation. Please wait before trying again.'
})

// Auth rate limiter - 5 attempts per 15 minutes
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
})

// Bulk operation rate limiter - 5 requests per minute
export const bulkRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'Too many bulk operations. Please wait before processing more items.'
})

// Email sending rate limiter - 50 emails per minute per customer
export const emailSendRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50,
  message: 'Email sending rate limit reached. Please wait before sending more emails.',
  keyGenerator: (req: Request) => {
    // Rate limit by customer ID if available
    const customerId = req.headers['x-customer-id'] || req.params.customerId
    const ip = defaultKeyGenerator(req)
    return customerId ? `email:${customerId}` : `email:${ip}`
  }
})
