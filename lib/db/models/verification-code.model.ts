import mongoose from 'mongoose';

export interface IVerificationCode extends mongoose.Document {
  email: string;
  code: string;
  type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
  expiresAt: Date;
  verified: boolean;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isExpired(): boolean;
}

const verificationCodeSchema = new mongoose.Schema<IVerificationCode>(
  {
    email: { 
      type: String, 
      required: true,
      lowercase: true,
      trim: true
    },
    code: { 
      type: String, 
      required: true,
      length: 8
    },
    type: {
      type: String,
      enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'],
      default: 'EMAIL_VERIFICATION',
      required: true
    },
    expiresAt: { 
      type: Date, 
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000)
    },
    verified: { 
      type: Boolean, 
      default: false,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// دالة للتحقق من انتهاء صلاحية الرمز
verificationCodeSchema.methods.isExpired = function(): boolean {
  return this.expiresAt < new Date();
};

// مؤشر مركب للبحث السريع (فقط مرة واحدة)
verificationCodeSchema.index({ email: 1, type: 1 });
verificationCodeSchema.index({ userId: 1 });

// التنظيف التلقائي للرموز منتهية الصلاحية (فقط مرة واحدة)
verificationCodeSchema.index(
  { expiresAt: 1 }, 
  { 
    expireAfterSeconds: 0,
    background: true 
  }
);

// التحقق قبل الحفظ
verificationCodeSchema.pre('save', function(next) {
  if (this.isModified('code') && !/^\d{6}$/.test(this.code)) {
    next(new Error('Verification code must be exactly 6 digits'));
  }
  next();
});

// إضافة virtual field لمعرفة الوقت المتبقي
verificationCodeSchema.virtual('timeRemaining').get(function() {
  const remaining = this.expiresAt.getTime() - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
});

const VerificationCode = mongoose.models.VerificationCode || 
  mongoose.model<IVerificationCode>('VerificationCode', verificationCodeSchema);

export default VerificationCode;