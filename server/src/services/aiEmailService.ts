/**
 * Gemini AI Service for Email Template Tweaking
 *
 * Uses the same direct Gemini API contract as the rest of the repo so
 * production AI features share one env/model path.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { extractPlaceholders } from './templateRenderer.js'

export interface AITweakRequest {
  templateBody: string
  templateSubject?: string
  contactName?: string
  contactCompany?: string
  contactTitle?: string
  contactIndustry?: string
  tone?: 'professional' | 'friendly' | 'casual' | 'formal' | 'persuasive'
  instruction?: string
  preservePlaceholders?: boolean
}

export interface AITweakResponse {
  tweakedBody: string
  tweakedSubject?: string
  changes?: string[]
}

type GeminiRequestOptions = {
  responseMimeType?: string
}

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const SYSTEM_PROMPT = `You are an expert email copywriter specializing in B2B outreach and sales emails. Your task is to personalize and improve email templates to make them more engaging, human, and effective.

Guidelines:
1. Keep the core message and call-to-action intact
2. Make the email feel personal and authentic, not robotic
3. Avoid generic phrases like "I hope this email finds you well"
4. Use natural language that sounds like a real person wrote it
5. Maintain professionalism while being conversational
6. Keep emails concise - busy professionals appreciate brevity
7. If placeholders like {{firstName}}, {{company}} exist, PRESERVE them exactly as-is
8. Focus on the recipient's potential pain points and how you can help

Output ONLY the improved email content. Do not include explanations, notes, or commentary.`

type ProtectedPlaceholderContent = {
  text: string
  original: string
  placeholders: string[]
}

function protectPlaceholders(input: string | undefined): ProtectedPlaceholderContent | null {
  if (!input) return null
  const placeholders = extractPlaceholders(input)
  if (placeholders.length === 0) {
    return { text: input, original: input, placeholders: [] }
  }

  let protectedText = input
  placeholders.forEach((placeholder, index) => {
    const marker = `[[ODCRM_TOKEN_${index}]]`
    const pattern = new RegExp(`\\{\\{\\s*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g')
    protectedText = protectedText.replace(pattern, marker)
  })

  return { text: protectedText, original: input, placeholders }
}

function restorePlaceholders(input: string, placeholders: string[]): string {
  return placeholders.reduce((output, placeholder, index) => {
    const marker = new RegExp(`\\[\\[ODCRM_TOKEN_${index}\\]\\]`, 'g')
    return output.replace(marker, `{{${placeholder}}}`)
  }, input)
}

function preservedPlaceholdersMatch(restored: string, expected: string[]): boolean {
  return expected.every((placeholder) => restored.includes(`{{${placeholder}}}`))
}

function getGeminiApiKey(): string | null {
  const allowEmergentGemini = process.env.ODCRM_USE_EMERGENT_LLM_KEY_FOR_GEMINI === 'true'
  const raw =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    (allowEmergentGemini ? process.env.EMERGENT_LLM_KEY : '') ||
    ''

  const value = String(raw).trim()
  return value || null
}

async function callGeminiText(prompt: string, options: GeminiRequestOptions = {}): Promise<string> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('AI service not configured. Set GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY. If EMERGENT_LLM_KEY is intentionally a Gemini key, also set ODCRM_USE_EMERGENT_LLM_KEY_FOR_GEMINI=true.')
  }

  const failures: string[] = []
  const client = new GoogleGenerativeAI(apiKey)

  for (const model of GEMINI_MODELS) {
    try {
      const modelClient = client.getGenerativeModel({ model })
      const result = await modelClient.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
        },
      })
      const text = result.response.text().trim()

      if (!text) {
        failures.push(`${model}: empty text response`)
        continue
      }

      return text
    } catch (sdkError) {
      const sdkMessage = sdkError instanceof Error ? sdkError.message : String(sdkError)
      failures.push(`${model}: ${sdkMessage}`)

      try {
        const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
              ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
            },
          }),
        })

        if (!response.ok) {
          const body = await response.text()
          failures.push(`${model}: ${response.status} ${body.slice(0, 300)}`)
          continue
        }

        const payload = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }

        const text = payload?.candidates?.[0]?.content?.parts
          ?.map((part) => part?.text || '')
          .join('')
          .trim()

        if (!text) {
          failures.push(`${model}: empty text response`)
          continue
        }

        return text
      } catch (fetchError) {
        failures.push(`${model}: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
      }
    }
  }

  console.error('[AI Service] Gemini API error:', failures)
  const firstFailure = failures[0] || 'unknown_upstream_error'
  if (/401|403|api key|permission|unauth/i.test(firstFailure)) {
    throw new Error('AI service authentication failed. Check the configured Gemini API key and model access.')
  }
  if (/429|quota|rate limit/i.test(firstFailure)) {
    throw new Error('AI service is temporarily rate limited. Please try again shortly.')
  }
  throw new Error(`AI provider request failed: ${firstFailure}`)
}

/**
 * Tweak an email template using Gemini AI
 */
export async function tweakEmailWithAI(request: AITweakRequest): Promise<AITweakResponse> {
  const {
    templateBody,
    templateSubject,
    contactName,
    contactCompany,
    contactTitle,
    contactIndustry,
    tone = 'professional',
    instruction,
    preservePlaceholders = true,
  } = request

  const contextParts: string[] = []
  if (contactName) contextParts.push(`Recipient Name: ${contactName}`)
  if (contactCompany) contextParts.push(`Company: ${contactCompany}`)
  if (contactTitle) contextParts.push(`Title/Role: ${contactTitle}`)
  if (contactIndustry) contextParts.push(`Industry: ${contactIndustry}`)

  const contextSection = contextParts.length > 0
    ? `\n\nRecipient Context:\n${contextParts.join('\n')}`
    : ''

  const toneInstruction = `\nDesired Tone: ${tone}`
  const customInstruction = instruction ? `\n\nSpecial Instructions: ${instruction}` : ''
  const placeholderNote = preservePlaceholders
    ? '\n\nIMPORTANT: Preserve any placeholder markers like [[ODCRM_TOKEN_0]] exactly as they appear.'
    : ''

  const bodyProtection = preservePlaceholders ? protectPlaceholders(templateBody) : null
  const subjectProtection = preservePlaceholders ? protectPlaceholders(templateSubject) : null
  const protectedBody = bodyProtection?.text ?? templateBody
  const protectedSubject = subjectProtection?.text ?? templateSubject
  const htmlStructureNote = /<[^>]+>/.test(`${templateBody || ''}${templateSubject || ''}`)
    ? '\n\nIMPORTANT: Preserve any existing HTML tags and structure.'
    : ''

  let userMessage = `${SYSTEM_PROMPT}

Please improve this email template:${contextSection}${toneInstruction}${customInstruction}${placeholderNote}${htmlStructureNote}

---
ORIGINAL EMAIL BODY:
${protectedBody}
---

Provide the improved email body:`

  if (templateSubject) {
    userMessage = `${SYSTEM_PROMPT}

Please improve this email template:${contextSection}${toneInstruction}${customInstruction}${placeholderNote}${htmlStructureNote}

---
ORIGINAL SUBJECT: ${protectedSubject}

ORIGINAL EMAIL BODY:
${protectedBody}
---

Provide the improved subject line first, then the improved email body. Format:
SUBJECT: [improved subject]
BODY:
[improved body]`
  }

  const response = await callGeminiText(userMessage)

  if (templateSubject) {
    const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?:\n|BODY:)/is)
    const bodyMatch = response.match(/BODY:\s*([\s\S]+)/i)
    let tweakedSubject = subjectMatch ? subjectMatch[1].trim() : (protectedSubject || '')
    let tweakedBody = bodyMatch ? bodyMatch[1].trim() : response.trim()

    if (preservePlaceholders) {
      if (subjectProtection) {
        tweakedSubject = restorePlaceholders(tweakedSubject, subjectProtection.placeholders)
        if (!preservedPlaceholdersMatch(tweakedSubject, subjectProtection.placeholders)) {
          tweakedSubject = subjectProtection.original
        }
      }
      if (bodyProtection) {
        tweakedBody = restorePlaceholders(tweakedBody, bodyProtection.placeholders)
        if (!preservedPlaceholdersMatch(tweakedBody, bodyProtection.placeholders)) {
          tweakedBody = bodyProtection.original
        }
      }
    }

    return {
      tweakedSubject: tweakedSubject || templateSubject,
      tweakedBody,
    }
  }

  let tweakedBody = response.trim()
  if (preservePlaceholders && bodyProtection) {
    tweakedBody = restorePlaceholders(tweakedBody, bodyProtection.placeholders)
    if (!preservedPlaceholdersMatch(tweakedBody, bodyProtection.placeholders)) {
      tweakedBody = bodyProtection.original
    }
  }

  return {
    tweakedBody,
  }
}

/**
 * Generate email variations for A/B testing
 */
export async function generateEmailVariations(
  templateBody: string,
  templateSubject: string,
  count: number = 3
): Promise<Array<{ subject: string; body: string; variant: string }>> {
  const tones: Array<'professional' | 'friendly' | 'casual' | 'formal' | 'persuasive'> =
    ['professional', 'friendly', 'persuasive']

  const variations = await Promise.all(
    tones.slice(0, count).map(async (tone, index) => {
      const result = await tweakEmailWithAI({
        templateBody,
        templateSubject,
        tone,
        instruction: `Create variation ${index + 1} with a ${tone} approach`,
      })

      return {
        subject: result.tweakedSubject || templateSubject,
        body: result.tweakedBody,
        variant: `${tone.charAt(0).toUpperCase()}${tone.slice(1)} Variant`,
      }
    })
  )

  return variations
}

/**
 * Analyze an email template and suggest improvements
 */
export async function analyzeEmailTemplate(
  templateBody: string,
  templateSubject?: string
): Promise<{ score: number; suggestions: string[]; strengths: string[] }> {
  const analysisPrompt = `Analyze this email template and provide:
1. A score from 1-10 for effectiveness
2. 3-5 specific suggestions for improvement
3. 2-3 strengths of the current template

${templateSubject ? `Subject: ${templateSubject}\n` : ''}
Body:
${templateBody}

Respond in JSON format only:
{
  "score": <number>,
  "suggestions": ["suggestion1", "suggestion2", ...],
  "strengths": ["strength1", "strength2", ...]
}`

  try {
    const response = await callGeminiText(analysisPrompt, { responseMimeType: 'application/json' })
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return {
      score: 5,
      suggestions: ['Unable to parse AI response'],
      strengths: ['Template received for analysis'],
    }
  } catch (error) {
    console.error('[AI Service] Analysis error:', error)
    throw new Error('Failed to analyze template.')
  }
}
