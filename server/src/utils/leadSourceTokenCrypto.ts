/**
 * AES-256-GCM encryption for Cognism API tokens at rest.
 * Requires LEAD_SOURCE_SECRETS_KEY: 32-byte key as base64 (openssl rand -base64 32).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const PREFIX = 'odcrm-aes256gcm:v1:'

function getKey(): Buffer {
  const b64 = process.env.LEAD_SOURCE_SECRETS_KEY?.trim()
  if (!b64) {
    throw new Error(
      'LEAD_SOURCE_SECRETS_KEY is not configured (expected base64 for 32-byte key). Cannot store Cognism API tokens.'
    )
  }
  const buf = Buffer.from(b64, 'base64')
  if (buf.length !== 32) {
    throw new Error('LEAD_SOURCE_SECRETS_KEY must decode to exactly 32 bytes (use openssl rand -base64 32).')
  }
  return buf
}

export function encryptLeadSourceSecret(plain: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}.${enc.toString('base64')}.${tag.toString('base64')}`
}

export function decryptLeadSourceSecret(payload: string): string {
  const key = getKey()
  if (!payload.startsWith(PREFIX)) {
    throw new Error('Invalid encrypted token payload')
  }
  const rest = payload.slice(PREFIX.length)
  const [ivB64, encB64, tagB64] = rest.split('.')
  if (!ivB64 || !encB64 || !tagB64) throw new Error('Invalid encrypted token payload')
  const iv = Buffer.from(ivB64, 'base64')
  const enc = Buffer.from(encB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

export function isLeadSourceSecretEncryptionConfigured(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}
