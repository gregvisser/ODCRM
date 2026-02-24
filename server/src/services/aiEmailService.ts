/**
 * Gemini AI Service for Email Template Tweaking
 * Uses Google Gemini 3 Flash model via Google Generative AI SDK
 * 
 * Features:
 * - Personalize email templates based on recipient context
 * - Adjust tone (professional, friendly, casual, formal, persuasive)
 * - Make generic templates feel more human and engaging
 * - Preserve core message while improving readability
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

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

/**
 * Get configured Gemini client
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.EMERGENT_LLM_KEY || process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('AI service not configured. Set EMERGENT_LLM_KEY or GEMINI_API_KEY environment variable.')
  }
  
  return new GoogleGenerativeAI(apiKey)
}

/**
 * Tweak an email template using Gemini AI
 */
export async function tweakEmailWithAI(request: AITweakRequest): Promise<AITweakResponse> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT
  })

  const {
    templateBody,
    templateSubject,
    contactName,
    contactCompany,
    contactTitle,
    contactIndustry,
    tone = 'professional',
    instruction,
    preservePlaceholders = true
  } = request

  // Build context for personalization
  const contextParts: string[] = []
  if (contactName) contextParts.push(`Recipient Name: ${contactName}`)
  if (contactCompany) contextParts.push(`Company: ${contactCompany}`)
  if (contactTitle) contextParts.push(`Title/Role: ${contactTitle}`)
  if (contactIndustry) contextParts.push(`Industry: ${contactIndustry}`)

  const contextSection = contextParts.length > 0 
    ? `\n\nRecipient Context:\n${contextParts.join('\n')}`
    : ''

  const toneInstruction = `\nDesired Tone: ${tone}`
  
  const customInstruction = instruction 
    ? `\n\nSpecial Instructions: ${instruction}`
    : ''

  const placeholderNote = preservePlaceholders
    ? '\n\nIMPORTANT: Preserve any placeholders like {{firstName}}, {{company}}, {{title}} exactly as they appear.'
    : ''

  // Prepare the user message
  let userMessage = `Please improve this email template:${contextSection}${toneInstruction}${customInstruction}${placeholderNote}

---
ORIGINAL EMAIL BODY:
${templateBody}
---

Provide the improved email body:`

  // If subject is provided, include it
  if (templateSubject) {
    userMessage = `Please improve this email template:${contextSection}${toneInstruction}${customInstruction}${placeholderNote}

---
ORIGINAL SUBJECT: ${templateSubject}

ORIGINAL EMAIL BODY:
${templateBody}
---

Provide the improved subject line first, then the improved email body. Format:
SUBJECT: [improved subject]
BODY:
[improved body]`
  }

  try {
    const result = await model.generateContent(userMessage)
    const response = result.response.text()

    // Parse response
    if (templateSubject) {
      // Extract subject and body from formatted response
      const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?:\n|BODY:)/is)
      const bodyMatch = response.match(/BODY:\s*([\s\S]+)/i)

      return {
        tweakedSubject: subjectMatch ? subjectMatch[1].trim() : templateSubject,
        tweakedBody: bodyMatch ? bodyMatch[1].trim() : response.trim()
      }
    }

    return {
      tweakedBody: response.trim()
    }
  } catch (error) {
    console.error('[AI Service] Gemini API error:', error)
    throw new Error('Failed to generate AI response. Please try again.')
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
        instruction: `Create variation ${index + 1} with a ${tone} approach`
      })
      
      return {
        subject: result.tweakedSubject || templateSubject,
        body: result.tweakedBody,
        variant: `${tone.charAt(0).toUpperCase()}${tone.slice(1)} Variant`
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
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    systemInstruction: 'You are an email marketing expert. Analyze emails and provide actionable feedback in JSON format only.'
  })

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
    const result = await model.generateContent(analysisPrompt)
    const response = result.response.text()
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    // Fallback if JSON parsing fails
    return {
      score: 5,
      suggestions: ['Unable to parse AI response'],
      strengths: ['Template received for analysis']
    }
  } catch (error) {
    console.error('[AI Service] Analysis error:', error)
    throw new Error('Failed to analyze template.')
  }
}
