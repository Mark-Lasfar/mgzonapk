// /home/mark/Music/my-nextjs-project-clean/lib/config/email.ts
export const EMAIL_CONFIG = {
  SMTP: {
    HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    PORT: parseInt(process.env.SMTP_PORT || '465', 10),
    USER: process.env.SMTP_USER || 'marklasfar@gmail.com',
    PASS: process.env.SMTP_PASS || (() => {
      throw new Error('SMTP_PASS is not defined in environment variables');
    })(),
    SECURE: true,
  },
  FROM: {
    NAME: process.env.FROM_NAME || 'MGZon',
    EMAIL: process.env.SMTP_USER || 'marklasfar@gmail.com',
  },
  TEMPLATES: {
    VERIFICATION: {
      SUBJECT: 'Email Verification - MGZon',
    },
    ORDER_CONFIRMATION: {
      SUBJECT: 'Order Confirmation - MGZon',
    },
    PASSWORD_RESET: {
      SUBJECT: 'Password Reset - MGZon',
    },
    SUBSCRIPTION_CONFIRMATION: {
      SUBJECT: 'Subscription Confirmation - MGZon',
    },
  },
  VERIFICATION: {
    CODE_EXPIRY: 600000, // 10 minutes
    MAX_ATTEMPTS: 5,
  },
};