/**
 * Định nghĩa kiểu Multer File cho Express / NestJS
 */
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer: Buffer;
}

declare global {
  namespace Express {
    namespace Multer {
      interface File extends MulterFile {}
    }
  }
}
