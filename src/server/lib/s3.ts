import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createId } from "@paralleldrive/cuid2"
import { privateEnv } from "@/env.private"

class S3CustomClient {
  private client: S3Client | null = null

  private getClient(): S3Client {
    if (!this.client) {
      if (!privateEnv.S3_ENDPOINT || !privateEnv.S3_ACCESS_KEY_ID || !privateEnv.S3_SECRET_ACCESS_KEY) {
        throw new Error("S3 not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.")
      }
      this.client = new S3Client({
        endpoint: privateEnv.S3_ENDPOINT,
        region: privateEnv.S3_REGION,
        credentials: {
          accessKeyId: privateEnv.S3_ACCESS_KEY_ID,
          secretAccessKey: privateEnv.S3_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      })
    }
    return this.client
  }

  get isConfigured() {
    return !!(privateEnv.S3_ENDPOINT && privateEnv.S3_ACCESS_KEY_ID && privateEnv.S3_SECRET_ACCESS_KEY)
  }

  generateUniqueId() {
    return createId()
  }

  async generateUploadUrl(destinationObjectKey: string) {
    const command = new PutObjectCommand({
      Bucket: privateEnv.S3_BUCKET_NAME,
      Key: destinationObjectKey,
    })

    const signedUrl = await getSignedUrl(this.getClient(), command, { expiresIn: 900 })

    return { signedUrl, fields: [] }
  }

  async getSignedUrlFromKey(objectKey: string, opts: { expiresIn?: number } = {}) {
    const { expiresIn = 86400 } = opts

    try {
      const command = new GetObjectCommand({
        Bucket: privateEnv.S3_BUCKET_NAME,
        Key: objectKey,
      })

      return await getSignedUrl(this.getClient(), command, { expiresIn })
    } catch (err) {
      console.error("Error creating presigned URL", err)
      return null
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: privateEnv.S3_BUCKET_NAME,
      Key: objectKey,
    })
    await this.getClient().send(command)
  }
}

export const s3Client = new S3CustomClient()
