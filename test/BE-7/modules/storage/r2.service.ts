import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class R2Service {
  private s3Client: S3Client;
  private bucketName: string;
  private publicDomain: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') ?? '';
    this.publicDomain = this.configService.get<string>('R2_PUBLIC_DOMAIN') ?? '';

    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY') ?? '';

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true,
      
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async generatePresignedUrl(fileName: string, fileType: string, folder: string = 'products') {
    try {
      const fileExtension = fileName.split('.').pop();
      const safeFileName = uuidv4(); 
      const key = `${folder}/${safeFileName}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: fileType,
        // ACL: 'public-read', // R2 thường không cần cái này nếu bucket public, nhưng nếu lỗi Access Denied thì hãy thử bật lại
      });

      // Tạo URL ký sẵn
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });

      return {
        uploadUrl, 
        fileUrl: `${this.publicDomain}/${key}`, 
      };
    } catch (error) {
      console.error('R2 Presigned Error:', error);
      throw new InternalServerErrorException('Could not generate upload URL');
    }
  }

  async deleteFile(key: string) {
    try {
        // Xử lý key: Nếu key truyền vào là full URL, cần cắt bỏ phần domain
        let cleanKey = key;
        if (key.includes(this.publicDomain)) {
            cleanKey = key.replace(`${this.publicDomain}/`, '');
        }

        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        });
        await this.s3Client.send(command);
    } catch (error) {
        console.error('R2 Delete Error (Ignored):', error);
    }
  }
}