/**
 * Azure Blob Storage SAS (Shared Access Signature) Utility
 * 
 * Generates time-limited, read-only URLs for private blob access.
 * Containers remain PRIVATE - no public access required.
 * 
 * Environment Variables Required:
 * - AZURE_STORAGE_CONNECTION_STRING: Azure Storage account connection string
 */

import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'

type GenerateSasUrlParams = {
  /** Container name */
  containerName: string
  /** Blob name (not URL-encoded) */
  blobName: string
  /** TTL in minutes (default: 15) */
  ttlMinutes?: number
}

type GenerateSasUrlResult = {
  /** Full SAS URL with query parameters */
  url: string
  /** Expiration time */
  expiresAt: Date
}

/**
 * Generate a read-only SAS URL for a blob
 * 
 * @param params - Container, blob name, and TTL
 * @returns Promise<GenerateSasUrlResult> - SAS URL and expiration
 * @throws Error if connection string invalid or blob generation fails
 */
export async function generateBlobSasUrl(
  params: GenerateSasUrlParams
): Promise<GenerateSasUrlResult> {
  const { containerName, blobName, ttlMinutes = 15 } = params

  // Validate environment variables
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING environment variable is required for SAS generation'
    )
  }

  // Parse account name and key from connection string
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/)
  const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/)

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error(
      'Could not parse AccountName or AccountKey from AZURE_STORAGE_CONNECTION_STRING'
    )
  }

  const storageAccountName = accountNameMatch[1]
  const accountKey = accountKeyMatch[1]

  try {
    // Create shared key credential
    const sharedKeyCredential = new StorageSharedKeyCredential(
      storageAccountName,
      accountKey
    )

    // Initialize Blob Service Client
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blobClient = containerClient.getBlobClient(blobName)

    // Verify blob exists before generating SAS
    const exists = await blobClient.exists()
    if (!exists) {
      throw new Error(`Blob not found: ${containerName}/${blobName}`)
    }

    // Calculate SAS times (with clock skew tolerance)
    const startsOn = new Date()
    startsOn.setMinutes(startsOn.getMinutes() - 5) // Clock skew: start 5 minutes ago

    const expiresOn = new Date()
    expiresOn.setMinutes(expiresOn.getMinutes() + ttlMinutes) // Expires in TTL minutes

    // Generate SAS with read-only permissions
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('r'), // Read-only
        startsOn,
        expiresOn,
      },
      sharedKeyCredential
    ).toString()

    // Construct full SAS URL
    const sasUrl = `${blobClient.url}?${sasToken}`

    console.log(
      `[blobSas] Generated SAS for ${blobName} (expires: ${expiresOn.toISOString()})`
    )

    return {
      url: sasUrl,
      expiresAt: expiresOn,
    }
  } catch (error) {
    console.error('[blobSas] Failed to generate SAS URL:', {
      containerName,
      blobName,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw new Error(
      `Failed to generate SAS URL: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

// Back-compat: Agreement codepaths call this name.
export async function generateAgreementSasUrl(
  params: GenerateSasUrlParams
): Promise<GenerateSasUrlResult> {
  return generateBlobSasUrl(params)
}
