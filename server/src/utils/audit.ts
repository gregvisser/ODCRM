/**
 * Safe Audit Event Helper
 * 
 * CRITICAL: This helper ensures audit logging NEVER throws or blocks operations.
 * Archive/unarchive operations must succeed even if audit logging fails.
 * 
 * Valid ClientStatus enum values: 'active' | 'inactive' | 'onboarding' | 'win_back'
 * NEVER use 'archived' - that's not a valid ClientStatus!
 */

import { PrismaClient, Prisma, ClientStatus } from '@prisma/client'

// Validate that a status is a valid ClientStatus enum value
function isValidClientStatus(status: unknown): status is ClientStatus {
  return status === 'active' || status === 'inactive' || status === 'onboarding' || status === 'win_back'
}

// Get a safe status value, defaulting to 'active' if invalid/null
function getSafeStatus(status: unknown): ClientStatus {
  if (isValidClientStatus(status)) {
    return status
  }
  return 'active'
}

export interface SafeAuditResult {
  success: boolean
  auditId?: string
  error?: string
}

export interface SafeAuditParams {
  prisma: PrismaClient
  customerId: string
  action: string
  actorUserId?: string | null
  actorEmail?: string | null
  customerStatus?: unknown // Will be validated and sanitized
  metadata?: Prisma.InputJsonValue
  requestId?: string
}

/**
 * Safely create a customer audit event.
 * 
 * GUARANTEES:
 * - Will NEVER throw
 * - Will NEVER block the calling operation
 * - Returns { success: true } if logged, { success: false, error } if not
 * 
 * For archive/unarchive operations:
 * - fromStatus and toStatus are set to the SAME value (the customer's current clientStatus)
 * - Archive state is NOT tracked via status - it's in the isArchived boolean field
 * - Archive-specific info goes in metadata (archiveAction, wasArchived, isNowArchived, etc.)
 */
export async function safeCustomerAuditEvent(params: SafeAuditParams): Promise<SafeAuditResult> {
  const { prisma, customerId, action, actorUserId, actorEmail, customerStatus, metadata, requestId } = params
  
  try {
    // Sanitize status to valid ClientStatus enum value
    const safeStatus = getSafeStatus(customerStatus)
    
    const auditEvent = await prisma.customerAuditEvent.create({
      data: {
        customerId,
        action,
        actorUserId: actorUserId ?? null,
        actorEmail: actorEmail ?? null,
        fromStatus: safeStatus,
        toStatus: safeStatus, // Archive doesn't change status - it changes isArchived boolean
        metadata: metadata ?? Prisma.JsonNull
      }
    })
    
    return { success: true, auditId: auditEvent.id }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown audit error'
    console.warn(`[AUDIT_FAILED] customerId=${customerId} action=${action} requestId=${requestId ?? 'unknown'} error="${errorMessage}"`)
    return { success: false, error: errorMessage }
  }
}

/**
 * Safely create multiple customer audit events (bulk operation).
 * 
 * GUARANTEES:
 * - Will NEVER throw
 * - Will NEVER block the calling operation
 * - Returns { success: true, count } if logged, { success: false, error } if not
 */
export async function safeCustomerAuditEventBulk(
  prisma: PrismaClient,
  events: Array<{
    customerId: string
    action: string
    actorUserId?: string | null
    actorEmail?: string | null
    customerStatus?: unknown
    metadata?: Prisma.InputJsonValue
  }>,
  requestId?: string
): Promise<SafeAuditResult & { count?: number }> {
  try {
    const sanitizedEvents = events.map(event => ({
      customerId: event.customerId,
      action: event.action,
      actorUserId: event.actorUserId ?? null,
      actorEmail: event.actorEmail ?? null,
      fromStatus: getSafeStatus(event.customerStatus),
      toStatus: getSafeStatus(event.customerStatus),
      metadata: event.metadata ?? Prisma.JsonNull
    }))
    
    const result = await prisma.customerAuditEvent.createMany({
      data: sanitizedEvents
    })
    
    return { success: true, count: result.count }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown audit error'
    console.warn(`[AUDIT_BULK_FAILED] eventCount=${events.length} requestId=${requestId ?? 'unknown'} error="${errorMessage}"`)
    return { success: false, error: errorMessage }
  }
}
