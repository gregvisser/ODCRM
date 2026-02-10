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
  /** Public or SAS URL to access the uploaded blob */
  url: string
  /** Full blob name including path */
  blobName: string
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

  // Validate environment variables
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING environment variable is required for blob uploads'
    )
  }

  const containerName =
    process.env.AZURE_STORAGE_CONTAINER_AGREEMENTS || 'customer-agreements'

  try {
    // Initialize Blob Service Client
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)

    // Get container client (create if not exists)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    
    // Create container if it doesn't exist (idempotent)
    // Note: In production, container should be pre-created with proper access level
    await containerClient.createIfNotExists({
      access: 'blob', // Public read access for blobs (not container listing)
    })

    // Get blob client for upload
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    // Upload options
    const uploadOptions: BlockBlobUploadOptions = {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    }

    // Upload file
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

    // Return the blob URL (publicly accessible if container is public)
    const url = blockBlobClient.url

    console.log('[blobUpload] Successfully uploaded agreement:', {
      blobName,
      url,
      size: buffer.length,
      contentType,
    })

    return {
      url,
      blobName,
    }
  } catch (error) {
    console.error('[blobUpload] Failed to upload agreement:', {
      blobName,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw new Error(
      `Failed to upload agreement to Azure Blob Storage: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
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
