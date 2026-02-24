import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { sendEmail } from '../services/outlookEmailService.js'
import { applyTemplatePlaceholders } from '../services/templateRenderer.js'

// Unique instance ID for multi-instance environments (Azure, scaling)
const SCHEDULER_INSTANCE_ID = `sched-${process.pid}-${Date.now().toString(36)}`

/**
 * Background worker that runs every minute to send scheduled emails
 */
export function startEmailScheduler(prisma: PrismaClient) {
  // Check if workers are disabled
  if (process.env.EMAIL_WORKERS_DISABLED === 'true') {
    console.log(`⚠️ [emailScheduler] ${SCHEDULER_INSTANCE_ID} - Email scheduler NOT started (EMAIL_WORKERS_DISABLED=true)`)
    return
  }

  // Run every minute
  cron.schedule('* * * * *', async () => {
    const startTime = Date.now()
    const timestamp = new Date().toISOString()
    
    // Low-noise heartbeat log (once per interval)
    console.log(`[emailScheduler] ${SCHEDULER_INSTANCE_ID} - ${timestamp} - tick`)
    
    try {
      const result = await processScheduledEmails(prisma)
      const elapsedMs = Date.now() - startTime
      
      // Only log details if something happened
      if (result.sent > 0 || result.errors > 0) {
        console.log(`[emailScheduler] ${SCHEDULER_INSTANCE_ID} - ${timestamp} - sent: ${result.sent}, errors: ${result.errors}, elapsed: ${elapsedMs}ms`)
      }
    } catch (error) {
      console.error(`[emailScheduler] ${SCHEDULER_INSTANCE_ID} - ${timestamp} - ERROR:`, error)
    }
  })

  console.log(`✅ [emailScheduler] ${SCHEDULER_INSTANCE_ID} - Email scheduler started (runs every minute)`)
}

async function processScheduledEmails(prisma: PrismaClient): Promise<{ sent: number; errors: number }> {
  let sentCount = 0
  let errorCount = 0
  
  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Find all running campaigns
  const runningCampaigns = await prisma.emailCampaign.findMany({
    where: { status: 'running' },
    include: {
      senderIdentity: true,
      templates: {
        orderBy: { stepNumber: 'asc' }
      }
    }
  })

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  const getScheduleNow = (timeZone: string) => {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    })
    const parts = dtf.formatToParts(now)
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
    const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00'
    const hour = parseInt(hourStr, 10)
    const day = weekdayMap[weekday] ?? 1
    return { day, hour }
  }

  for (const campaign of runningCampaigns) {
    const senderIdentity = campaign.senderIdentity
    if (!senderIdentity) {
      console.log(`[emailScheduler] ${SCHEDULER_INSTANCE_ID} - Campaign ${campaign.id} has no sender identity`)
      continue
    }

    // Check if we're within send window using sender identity's configuration
    const timeZone = senderIdentity.sendWindowTimeZone || 'UTC'
    const senderTime = new Date(now.toLocaleString('en-US', { timeZone }))
    const currentHour = senderTime.getHours()

    const windowStart = senderIdentity.sendWindowHoursStart ?? 9
    const windowEnd = senderIdentity.sendWindowHoursEnd ?? 17

    // Handle wrap-around windows (e.g., 22 to 6)
    const inWindow = windowStart <= windowEnd
      ? (currentHour >= windowStart && currentHour < windowEnd)
      : (currentHour >= windowStart || currentHour < windowEnd)

    if (!inWindow) {
      console.log(`[emailScheduler] ${SCHEDULER_INSTANCE_ID} - Outside send window for ${senderIdentity.emailAddress} (${currentHour} not in ${windowStart}-${windowEnd})`)
      continue
    }

    // Check daily send limit for this identity
    const todayStart = new Date(senderTime)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(senderTime)
    todayEnd.setHours(23, 59, 59, 999)

    const emailsSentToday = await prisma.emailEvent.count({
      where: {
        senderIdentityId: senderIdentity.id,
        type: 'sent',
        occurredAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    })

    const dailyLimit = senderIdentity.dailySendLimit || 150
    if (emailsSentToday >= dailyLimit) {
      console.log(`[emailScheduler] ${SCHEDULER_INSTANCE_ID} - Daily limit reached for ${senderIdentity.emailAddress}: ${emailsSentToday}/${dailyLimit}`)
      continue
    }

    // Per-identity hourly cap: derived from daily limit ÷ EMAIL_HOURLY_SEND_FACTOR (default 8)
    // e.g. 150/day ÷ 8 = ~18/hour. Configurable via env without schema changes.
    const hourlyFactor = Math.max(1, parseInt(process.env.EMAIL_HOURLY_SEND_FACTOR || '8', 10))
    const hourlyLimit = Math.ceil(dailyLimit / hourlyFactor)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const emailsSentThisHour = await prisma.emailEvent.count({
      where: {
        senderIdentityId: senderIdentity.id,
        type: 'sent',
        occurredAt: { gte: oneHourAgo },
      },
    })
    if (emailsSentThisHour >= hourlyLimit) {
      console.log(`[emailScheduler] ${SCHEDULER_INSTANCE_ID} - Hourly limit reached for ${senderIdentity.emailAddress}: ${emailsSentThisHour}/${hourlyLimit}`)
      continue
    }

    // Customer-level safety: hard cap total sends per 24h (rolling).
    // This reduces blacklist/domain risk when multiple identities/campaigns run.
    const customerSentLast24h = await prisma.emailEvent.count({
      where: {
        type: 'sent',
        occurredAt: { gte: since24h },
        campaign: { customerId: campaign.customerId }
      }
    })
    if (customerSentLast24h >= 160) {
      console.log(`⚠️ Customer 24h send cap reached (${customerSentLast24h}/160) for customer ${campaign.customerId}`)
      continue
    }

    // Preload customer-scoped suppression set once per campaign (DNC)
    const suppressionSets = await loadSuppressionSets(prisma, campaign.customerId)

    // Preferred path: N-step sequences via EmailCampaignProspectStep.
    // If schema/client isn't migrated yet, fall back to legacy 2-step columns.
    let usedNewStepScheduling = false
    try {
      // Find due steps that haven't been sent AND haven't been claimed
      const dueSteps = await (prisma as any).emailCampaignProspectStep.findMany({
        where: {
          campaignId: campaign.id,
          scheduledAt: { lte: now },
          sentAt: null,
          claimedAt: null,  // IDEMPOTENCY: Not already claimed
          prospect: {
            unsubscribedAt: null,
            bouncedAt: null,
            replyDetectedAt: null,
            lastStatus: { not: 'suppressed' },
          }
        },
        include: {
          prospect: { include: { contact: true } }
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10
      })

      if (Array.isArray(dueSteps)) {
        // Filter suppressed recipients before sending (customer-scoped)
        const originalCount = dueSteps.length
        const suppressedRows = dueSteps.filter((row: any) =>
          isSuppressedInSets(suppressionSets, String(row?.prospect?.contact?.email || '')),
        )
        const allowedRows = dueSteps.filter((row: any) =>
          !isSuppressedInSets(suppressionSets, String(row?.prospect?.contact?.email || '')),
        )
        if (suppressedRows.length > 0) {
          console.log(
            `[emailScheduler] ${SCHEDULER_INSTANCE_ID} - customerId=${campaign.customerId} campaignId=${campaign.id} ` +
              `suppressed=${suppressedRows.length} original=${originalCount} final=${allowedRows.length}`,
          )
          // Mark suppressed prospects and remove any unsent future steps (best-effort)
          await prisma.emailCampaignProspect.updateMany({
            where: { id: { in: suppressedRows.map((r: any) => r.prospect?.id).filter(Boolean) } },
            data: { lastStatus: 'suppressed' } as any,
          })
          try {
            await (prisma as any).emailCampaignProspectStep.deleteMany({
              where: {
                campaignProspectId: { in: suppressedRows.map((r: any) => r.prospect?.id).filter(Boolean) },
                sentAt: null,
              },
            })
          } catch {
            // ignore if schema not migrated yet
          }
        }

        usedNewStepScheduling = true
        for (const row of allowedRows) {
          if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) break

          // Re-check customer cap as we send in batches
          const customerSent = await prisma.emailEvent.count({
            where: {
              type: 'sent',
              occurredAt: { gte: since24h },
              campaign: { customerId: campaign.customerId }
            }
          })
          if (customerSent >= 160) break

          // ATOMIC CLAIM: Try to claim this step for sending
          // Only succeeds if claimedAt is still null
          const claimResult = await (prisma as any).emailCampaignProspectStep.updateMany({
            where: {
              id: row.id,
              sentAt: null,
              claimedAt: null,  // MUST be unclaimed
            },
            data: {
              claimedAt: new Date(),
              claimedBy: SCHEDULER_INSTANCE_ID,
            }
          })

          if (claimResult.count === 0) {
            // Another instance claimed this step
            console.log(
              `[emailScheduler] CLAIM_FAILED stepId=${row.id} prospectId=${row.campaignProspectId} ` +
              `step=${row.stepNumber} instance=${SCHEDULER_INSTANCE_ID} - already claimed`
            )
            continue
          }

          const prospect = row.prospect
          const stepNumber = row.stepNumber
          const success = await sendCampaignEmail(prisma, campaign, prospect, stepNumber)
          if (success) sentCount++
          else errorCount++

          // Mark row as sent (the claim already happened)
          await (prisma as any).emailCampaignProspectStep.update({
            where: { id: row.id },
            data: { sentAt: new Date() } as any })

          // Schedule next step if it exists
          const nextStepNumber = stepNumber + 1
          const nextTemplate = campaign.templates.find((t: any) => t.stepNumber === nextStepNumber)
          if (nextTemplate) {
            const min = Number.isFinite(nextTemplate.delayDaysMin) ? nextTemplate.delayDaysMin : campaign.followUpDelayDaysMin
            const max = Number.isFinite(nextTemplate.delayDaysMax) ? nextTemplate.delayDaysMax : campaign.followUpDelayDaysMax
            const delayDays = min + Math.random() * Math.max(0, (max - min))
            const scheduledAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000)

            await (prisma as any).emailCampaignProspectStep.upsert({
              where: {
                campaignProspectId_stepNumber: {
                  campaignProspectId: prospect.id,
                  stepNumber: nextStepNumber
                }
              },
              update: { scheduledAt },
              create: {
                campaignId: campaign.id,
                campaignProspectId: prospect.id,
                stepNumber: nextStepNumber,
                scheduledAt
              }
            })
          } else {
            // No next template; consider sequence done.
            await prisma.emailCampaignProspect.update({
              where: { id: prospect.id },
              data: { lastStatus: 'completed' } as any })
          }

          emailsSentToday++
        }
      }
    } catch {
      // ignored; fallback below
    }

    if (usedNewStepScheduling) continue

    // Legacy fallback: 2-step campaigns using fixed columns.
    // Note: Only get prospects that are 'pending' (not 'sending')
    const step1Ready = await prisma.emailCampaignProspect.findMany({
      where: {
        campaignId: campaign.id,
        lastStatus: 'pending',
        step1ScheduledAt: { lte: now },
        step1SentAt: null,
        unsubscribedAt: null,
        bouncedAt: null,
        replyDetectedAt: null
      },
      include: {
        contact: true
      },
      take: 10 // Process in batches
    })

    // Filter suppressed recipients before sending (customer-scoped)
    {
      const originalCount = step1Ready.length
      const suppressed = step1Ready.filter((p: any) => isSuppressedInSets(suppressionSets, String(p?.contact?.email || '')))
      if (suppressed.length > 0) {
        console.log(
          `[emailScheduler] ${SCHEDULER_INSTANCE_ID} - customerId=${campaign.customerId} campaignId=${campaign.id} step=1 ` +
            `suppressed=${suppressed.length} original=${originalCount} final=${originalCount - suppressed.length}`,
        )
        await prisma.emailCampaignProspect.updateMany({
          where: { id: { in: suppressed.map((p: any) => p.id) }, lastStatus: 'pending' },
          data: { lastStatus: 'suppressed' } as any,
        })
      }
    }

    for (const prospect of step1Ready.filter((p: any) => !isSuppressedInSets(suppressionSets, String(p?.contact?.email || '')))) {
      if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) break
      
      // ATOMIC CLAIM: Change status from 'pending' to 'sending'
      const claimResult = await prisma.emailCampaignProspect.updateMany({
        where: {
          id: prospect.id,
          lastStatus: 'pending',  // MUST be pending to claim
          step1SentAt: null,
        },
        data: {
          lastStatus: 'sending',  // ATOMIC: changes the WHERE condition
        }
      })
      
      if (claimResult.count === 0) {
        // Another instance claimed this prospect
        console.log(
          `[emailScheduler] CLAIM_FAILED prospectId=${prospect.id} step=1 instance=${SCHEDULER_INSTANCE_ID} - already claimed`
        )
        continue
      }
      
      const success = await sendCampaignEmail(prisma, campaign, prospect, 1)
      if (success) sentCount++
      else errorCount++
      emailsSentToday++
    }

    const step2Ready = await prisma.emailCampaignProspect.findMany({
      where: {
        campaignId: campaign.id,
        lastStatus: 'step1_sent',
        step2ScheduledAt: { lte: now },
        step2SentAt: null,
        unsubscribedAt: null,
        bouncedAt: null,
        replyDetectedAt: null
      },
      include: {
        contact: true
      },
      take: 10 // Process in batches
    })

    // Filter suppressed recipients before sending (customer-scoped)
    {
      const originalCount = step2Ready.length
      const suppressed = step2Ready.filter((p: any) => isSuppressedInSets(suppressionSets, String(p?.contact?.email || '')))
      if (suppressed.length > 0) {
        console.log(
          `[emailScheduler] ${SCHEDULER_INSTANCE_ID} - customerId=${campaign.customerId} campaignId=${campaign.id} step=2 ` +
            `suppressed=${suppressed.length} original=${originalCount} final=${originalCount - suppressed.length}`,
        )
        await prisma.emailCampaignProspect.updateMany({
          where: { id: { in: suppressed.map((p: any) => p.id) }, lastStatus: 'step1_sent' },
          data: { lastStatus: 'suppressed' } as any,
        })
      }
    }

    for (const prospect of step2Ready.filter((p: any) => !isSuppressedInSets(suppressionSets, String(p?.contact?.email || '')))) {
      if (emailsSentToday >= campaign.senderIdentity.dailySendLimit) break
      
      // ATOMIC CLAIM: Change status from 'step1_sent' to 'sending'
      const claimResult = await prisma.emailCampaignProspect.updateMany({
        where: {
          id: prospect.id,
          lastStatus: 'step1_sent',  // MUST be step1_sent to claim for step 2
          step2SentAt: null,
        },
        data: {
          lastStatus: 'sending',  // ATOMIC: changes the WHERE condition
        }
      })
      
      if (claimResult.count === 0) {
        // Another instance claimed this prospect
        console.log(
          `[emailScheduler] CLAIM_FAILED prospectId=${prospect.id} step=2 instance=${SCHEDULER_INSTANCE_ID} - already claimed`
        )
        continue
      }
      
      const success = await sendCampaignEmail(prisma, campaign, prospect, 2)
      if (success) sentCount++
      else errorCount++
      emailsSentToday++
    }
  }
  
  return { sent: sentCount, errors: errorCount }
}

async function loadSuppressionSets(prisma: PrismaClient, customerId: string) {
  const entries = await prisma.suppressionEntry.findMany({
    where: { customerId, OR: [{ type: 'email' }, { type: 'domain' }] },
    select: { type: true, value: true, emailNormalized: true },
  })
  const emails = new Set<string>()
  const domains = new Set<string>()
  for (const e of entries) {
    if (e.type === 'email') {
      const v = String(e.emailNormalized || e.value || '').trim().toLowerCase()
      if (v) emails.add(v)
    } else if (e.type === 'domain') {
      const v = String(e.value || '').trim().toLowerCase()
      if (v) domains.add(v)
    }
  }
  return { emails, domains }
}

function isSuppressedInSets(s: { emails: Set<string>; domains: Set<string> }, email: string) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const domain = normalizedEmail.split('@')[1]
  if (!normalizedEmail || !domain) return false
  return s.emails.has(normalizedEmail) || s.domains.has(domain)
}

async function isSuppressed(prisma: PrismaClient, customerId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const domain = normalizedEmail.split('@')[1]
  if (!domain) return false

  const match = await prisma.suppressionEntry.findFirst({
    where: {
      customerId,
      OR: [
        { type: 'email', value: normalizedEmail },
        { type: 'domain', value: domain },
      ]
    },
    select: { id: true },
  })

  return Boolean(match)
}

async function sendCampaignEmail(
  prisma: PrismaClient,
  campaign: any,
  prospect: any,
  stepNumber: number
): Promise<boolean> {
  try {
    const recipientEmail = prospect.contact?.email?.toLowerCase()
    if (recipientEmail) {
      const suppressed = await isSuppressed(prisma, campaign.customerId, recipientEmail)
      if (suppressed) {
        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { lastStatus: 'suppressed' } as any
        })
        try {
          await (prisma as any).emailCampaignProspectStep.deleteMany({
            where: {
              campaignProspectId: prospect.id,
              sentAt: null
            }
          })
        } catch {
          // ignore if schema not migrated yet
        }
        return false // Suppressed, not sent
      }
    }

    const template = campaign.templates.find((t: any) => t.stepNumber === stepNumber)
    if (!template) {
      console.error(`Template for step ${stepNumber} not found for campaign ${campaign.id}`)
      return false
    }

    // Render template
    const variables = {
      firstName: prospect.contact.firstName,
      lastName: prospect.contact.lastName,
      companyName: prospect.contact.companyName,
      email: prospect.contact.email,
      jobTitle: prospect.contact.jobTitle,
    }
    
    const renderedHtml = applyTemplatePlaceholders(template.bodyTemplateHtml, variables)
    const renderedSubject = applyTemplatePlaceholders(template.subjectTemplate, variables)

    // Check for suppression before sending
    const normalizedEmail = prospect.contact.email.toLowerCase().trim()
    const domain = prospect.contact.email.split('@')[1]

    const suppressionCheck = await prisma.suppressionEntry.findFirst({
      where: {
        customerId: campaign.customerId,
        OR: [
          {
            type: 'email',
            emailNormalized: normalizedEmail,
          },
          {
            type: 'domain',
            value: domain,
          },
        ],
      },
      select: {
        type: true,
        value: true,
        reason: true,
      },
    })

    if (suppressionCheck) {
      console.log(`[emailScheduler] ${SCHEDULER_INSTANCE_ID} - SUPPRESSED: ${prospect.contact.email} (${suppressionCheck.type}: ${suppressionCheck.value}) - ${suppressionCheck.reason || 'No reason'}`)

      // Record suppressed event instead of sent
      await prisma.emailEvent.create({
        data: {
          customerId: campaign.customerId,
          campaignId: campaign.id,
          campaignProspectId: prospect.id,
          senderIdentityId: campaign.senderIdentityId,
          recipientEmail: prospect.contact.email,
          type: 'failed',
          metadata: {
            step: stepNumber,
            suppressed: true,
            suppressionType: suppressionCheck.type,
            suppressionValue: suppressionCheck.value,
            suppressionReason: suppressionCheck.reason,
            instanceId: SCHEDULER_INSTANCE_ID
          },
          occurredAt: new Date()
        }
      })

      // Mark prospect as failed/suppressed
      await prisma.emailCampaignProspect.update({
        where: { id: prospect.id },
        data: {
          lastStatus: 'suppressed',
          [`step${stepNumber}SentAt`]: new Date(),
        }
      })

      return false
    }

    // Inject tracking - MUST be set in production
    const trackingDomain = process.env.EMAIL_TRACKING_DOMAIN
    if (!trackingDomain) {
      console.warn('⚠️ EMAIL_TRACKING_DOMAIN not set - tracking will not work properly')
    }

    // Send email
    const result = await sendEmail(prisma, {
      senderIdentityId: campaign.senderIdentityId,
      toEmail: prospect.contact.email,
      subject: renderedSubject,
      htmlBody: renderedHtml,
      textBody: template.bodyTemplateText || renderedHtml,
      campaignProspectId: prospect.id
    })

    if (result.success) {
      const sentAt = new Date()
      const eventBase = {
        customerId: campaign.customerId,
        campaignId: campaign.id,
        campaignProspectId: prospect.id,
        senderIdentityId: campaign.senderIdentityId,
        recipientEmail: prospect.contact.email,
        metadata: { step: stepNumber, messageId: result.messageId, threadId: result.threadId, instanceId: SCHEDULER_INSTANCE_ID },
        occurredAt: sentAt,
      }
      // Record sent event
      await prisma.emailEvent.create({ data: { ...eventBase, type: 'sent' } })
      // Record delivered event — Graph API accepted the message (accepted-by-MTA = delivered)
      await prisma.emailEvent.create({ data: { ...eventBase, type: 'delivered' } })

      // Update prospect - finalize with proper status
      const updateData: any = {
        [`step${stepNumber}SentAt`]: new Date(),
        lastStatus: stepNumber === 1 ? 'step1_sent' : (`step${Math.min(stepNumber, 10)}_sent`)
      }

      await prisma.emailCampaignProspect.update({
        where: { id: prospect.id },
        data: updateData
      })

      // Legacy: If step 1, schedule step 2 using fixed columns
      if (stepNumber === 1) {
        const delayDays = campaign.followUpDelayDaysMin +
          Math.random() * (campaign.followUpDelayDaysMax - campaign.followUpDelayDaysMin)
        const step2ScheduledAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000)

        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { step2ScheduledAt } as any })
      } else if (stepNumber === 2) {
        // Legacy: Step 2 sent, mark as completed
        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: { lastStatus: 'completed' } as any })
      }

      // SUCCESS LOG with full details
      console.log(
        `[emailScheduler] SENT prospectId=${prospect.id} step=${stepNumber} ` +
        `identityId=${campaign.senderIdentityId} email=${prospect.contact.email} ` +
        `messageId=${result.messageId} instance=${SCHEDULER_INSTANCE_ID}`
      )
      return true
    } else {
      // Handle failure
      console.error(
        `[emailScheduler] SEND_FAILED prospectId=${prospect.id} step=${stepNumber} ` +
        `email=${prospect.contact.email} error="${result.error}" instance=${SCHEDULER_INSTANCE_ID}`
      )

      // Check if it's a bounce (permanent failure)
      if (result.error?.toLowerCase().includes('bounce') || 
          result.error?.toLowerCase().includes('rejected')) {
        await prisma.emailEvent.create({ data: {
            customerId: campaign.customerId,
            campaignId: campaign.id,
            campaignProspectId: prospect.id,
            senderIdentityId: campaign.senderIdentityId,
            recipientEmail: prospect.contact.email,
            type: 'bounced',
            metadata: { error: result.error, instanceId: SCHEDULER_INSTANCE_ID },
            occurredAt: new Date()
          }
        })

        await prisma.emailCampaignProspect.update({
          where: { id: prospect.id },
          data: {
            bouncedAt: new Date(),
            lastStatus: 'bounced'
          } as any })
      } else {
        // Non-bounce error (possibly transient) - revert 'sending' status so it can be retried
        // Determine what the previous status should be
        const previousStatus = stepNumber === 1 ? 'pending' : `step${stepNumber - 1}_sent`
        await prisma.emailCampaignProspect.updateMany({
          where: { id: prospect.id, lastStatus: 'sending' },
          data: { lastStatus: previousStatus } as any
        })
        console.log(
          `[emailScheduler] REVERTED prospectId=${prospect.id} step=${stepNumber} ` +
          `to status=${previousStatus} instance=${SCHEDULER_INSTANCE_ID}`
        )
      }
      return false
    }
  } catch (error) {
    // Unexpected error - revert status so retry is possible
    const previousStatus = stepNumber === 1 ? 'pending' : `step${stepNumber - 1}_sent`
    try {
      await prisma.emailCampaignProspect.updateMany({
        where: { id: prospect.id, lastStatus: 'sending' },
        data: { lastStatus: previousStatus } as any
      })
    } catch {
      // ignore - best effort
    }
    console.error(
      `[emailScheduler] ERROR prospectId=${prospect.id} step=${stepNumber} ` +
      `instance=${SCHEDULER_INSTANCE_ID}`,
      error
    )
    return false
  }
}
