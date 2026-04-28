
import OSS from 'ali-oss'
import path from 'node:path'
import crypto from 'node:crypto'
import '../config/env.ts'

export interface UploadBase64ImageOptions {
  base64: string
  filename?: string
  mimeType?: string
  dir?: string
}

export interface UploadResult {
  name: string
  url: string
  ossPath: string
}

export class OssUploader {
  private client: OSS
  private bucket: string
  private publicBaseUrl?: string
  private defaultDir: string

  constructor() {
    const region = process.env.OSS_REGION
    const bucket = process.env.OSS_BUCKET
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET

    if (!region) throw new Error('缺少环境变量 OSS_REGION')
    if (!bucket) throw new Error('缺少环境变量 OSS_BUCKET')
    if (!accessKeyId) throw new Error('缺少环境变量 OSS_ACCESS_KEY_ID')
    if (!accessKeySecret) throw new Error('缺少环境变量 OSS_ACCESS_KEY_SECRET')

    this.bucket = bucket
    this.publicBaseUrl = process.env.OSS_PUBLIC_BASE_URL
    this.defaultDir = process.env.OSS_UPLOAD_DIR || 'uploads'

    this.client = new OSS({
      region,
      bucket,
      accessKeyId,
      accessKeySecret,
    })
  }

  async uploadBase64Image(options: UploadBase64ImageOptions): Promise<UploadResult> {
    const {
      base64,
      filename,
      mimeType = 'image/png',
      dir = this.defaultDir,
    } = options

    const cleanBase64 = this.cleanBase64(base64)
    const buffer = Buffer.from(cleanBase64, 'base64')

    const ext = this.getExtByMimeType(mimeType)
    const finalFilename = filename || this.createFilename(ext)
    const ossPath = path.posix.join(dir, finalFilename)

    const result = await this.client.put(ossPath, buffer, {
      headers: {
        'Content-Type': mimeType,
      },
    })

    return {
      name: result.name,
      ossPath,
      url: this.getPublicUrl(ossPath, result.url),
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    filename?: string,
    mimeType = 'image/png',
    dir = this.defaultDir,
  ): Promise<UploadResult> {
    const ext = this.getExtByMimeType(mimeType)
    const finalFilename = filename || this.createFilename(ext)
    const ossPath = path.posix.join(dir, finalFilename)

    const result = await this.client.put(ossPath, buffer, {
      headers: {
        'Content-Type': mimeType,
      },
    })

    return {
      name: result.name,
      ossPath,
      url: this.getPublicUrl(ossPath, result.url),
    }
  }

  private cleanBase64(base64: string): string {
    if (base64.startsWith('data:image')) {
      return base64.split(',', 2)[1]
    }

    return base64
  }

  private createFilename(ext: string): string {
    const id = crypto.randomUUID()
    return `${Date.now()}-${id}.${ext}`
  }

  private getExtByMimeType(mimeType: string): string {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }

    return map[mimeType] || 'png'
  }

  private getPublicUrl(ossPath: string, fallbackUrl: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${ossPath}`
    }

    return fallbackUrl
  }
}
