// /home/hager/Trash/my-nextjs-project-master/lib/errors/seller-error.ts
export class SellerError extends Error {
  public code: string;
  public data?: any; // إضافة حقل اختياري لدعم بيانات إضافية

  constructor(message: string, code: string, data?: any) {
    super(message);
    this.name = 'SellerError';
    this.code = code;
    this.data = data;
    Object.setPrototypeOf(this, SellerError.prototype);
    Error.captureStackTrace(this, SellerError);
  }
}