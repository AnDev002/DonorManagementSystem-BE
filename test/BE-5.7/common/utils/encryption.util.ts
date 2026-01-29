import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const IV_LENGTH = 16;
// Đảm bảo key luôn đủ 32 ký tự (cho aes-256)
const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY || '12345678901234567890123456789012'; 

export class EncryptionUtil {
  static encrypt(text: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  static decrypt(text: string): string {
    if (!text || !text.includes(':')) return text; // Fallback nếu text không đúng định dạng mã hoá

    const textParts = text.split(':');
    const ivHex = textParts.shift(); // Lấy IV ra
    
    // --- SỬA LỖI TẠI ĐÂY ---
    if (!ivHex) {
      throw new Error('Invalid IV in encrypted text');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    // -----------------------

    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
}