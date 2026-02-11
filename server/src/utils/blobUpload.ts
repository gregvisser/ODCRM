/**
 * Azure Blob Storage Upload Utility
 * 
 * Provides durable storage for customer agreement files.
 * Replaces ephemeral local filesystem storage with Azure Blob Storage.
 * 
 * Environment Variables Required:
 * - AZURE_STORAGE_CONNECTION_STRING: Azure Storage account connection string
 * - AZURE_STORAGE_CONTAINER_AGREEMENTS: Container name (default: "customer-agreements")
 */

import { BlobServiceClient, BlockBlobUploadOptions } from '@azure/storage-blob'

type UploadAgreementParams = {
  /** File content as Buffer */
  buffer: Buffer
  /** MIME type (e.g., application/pdf) */
  contentType: string
  /** Unique blob name (e.g., agreement_cust_123_1234567890_contract.pdf) */
  blobName: string
}

type UploadAgreementResult = {
  /** Blob URL (for reference only - container is private, access requires SAS) */
  url: string
  /** Full blob name including path */
  blobName: string
}

type UploadToContainerParams = {
  buffer: Buffer
  contentType: string
  containerName: string
  blobName: string
}

async function uploadToContainer(params: UploadToContainerParams): Promise<UploadAgreementResult> {
  const { buffer, contentType, containerName, blobName } = params

  // Validate environment variables
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING environment variable is required for blob uploads'
    )
  }

  // Extract storage account name from connection string
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/)
  if (!accountNameMatch) {
    throw new Error('Could not parse AccountName from AZURE_STORAGE_CONNECTION_STRING')
  }
  const storageAccountName = accountNameMatch[1]

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // CRITICAL: Container MUST be private - all access via SAS only
    await containerClient.createIfNotExists()

    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    const uploadOptions: BlockBlobUploadOptions = {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    }

    const uploadResponse = await blockBlobClient.upload(
      buffer,
      buffer.length,
      uploadOptions
    )

    if (!uploadResponse._response.status || uploadResponse._response.status >= 400) {
      throw new Error(
        `Blob upload failed with status ${uploadResponse._response.status}`
      )
    }

    // Verify blob exists after upload
    const blobProperties = await blockBlobClient.getProperties()
    if (!blobProperties.contentLength || blobProperties.contentLength !== buffer.length) {
      throw new Error(
        `Blob verification failed: expected ${buffer.length} bytes, got ${blobProperties.contentLength || 0}`
      )
    }

    // Construct URL from scratch - DO NOT trust SDK url
    const encodedBlobName = encodeURIComponent(blobName)
    const url = `https://${storageAccountName}.blob.core.windows.net/${containerName}/${encodedBlobName}`

    console.log(`[blobUpload] ✅ ${blobName} → ${url} (${buffer.length} bytes)`)

    return {
      url,
      blobName,
    }
  } catch (error) {
    console.error('[blobUpload] Failed to upload blob:', {
      containerName,
      blobName,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw new Error(
      `Failed to upload blob to Azure Blob Storage: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

/**
 * Upload a customer agreement file to Azure Blob Storage
 * 
 * @param params - Upload parameters (buffer, contentType, blobName)
 * @returns Promise<UploadAgreementResult> - URL and blob name
 * @throws Error if upload fails or env vars missing
 */
export async function uploadAgreement(
  params: UploadAgreementParams
): Promise<UploadAgreementResult> {
  const { buffer, contentType, blobName } = params

  const containerName =
    process.env.AZURE_STORAGE_CONTAINER_AGREEMENTS || 'customer-agreements'
  return uploadToContainer({ buffer, contentType, containerName, blobName })
}

/**
 * Generate a unique blob name for an agreement file
 * 
 * Format: agreement_<customerId>_<timestamp>_<randomId>_<sanitizedFilename>
 * 
 * @param customerId - Customer ID (e.g., cust_abc123)
 * @param fileName - Original file name
 * @returns Unique blob name
 */
export function generateAgreementBlobName(
  customerId: string,
  fileName: string
): string {
  // Sanitize filename (remove special chars, keep alphanumeric and basic punctuation)
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const safeName = sanitized || 'agreement'

  // Generate unique blob name
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).slice(2, 8)
  const blobName = `agreement_${customerId}_${timestamp}_${randomId}_${safeName}`

  return blobName
}

export type UploadCustomerAttachmentParams = {
  buffer: Buffer
  contentType: string
  blobName: string
}

export type UploadCustomerAttachmentResult = UploadAgreementResult & {
  containerName: string
}

export async function uploadCustomerAttachment(
  params: UploadCustomerAttachmentParams
): Promise<UploadCustomerAttachmentResult> {
  const { buffer, contentType, blobName } = params
  const containerName =
    process.env.AZURE_STORAGE_CONTAINER_ATTACHMENTS || 'customer-attachments'

  const result = await uploadToContainer({ buffer, contentType, containerName, blobName })
  return { ...result, containerName }
}

export function generateCustomerAttachmentBlobName(
  customerId: string,
  attachmentType: string,
  fileName: string
): string {
  const sanitizedType = String(attachmentType || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_')
  const sanitized = String(fileName || '').replace(/[^a-zA-Z0-9._-]/g, '_')
  const safeName = sanitized || 'attachment'
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).slice(2, 8)
  return `attachment_${customerId}_${sanitizedType}_${timestamp}_${randomId}_${safeName}`
}
