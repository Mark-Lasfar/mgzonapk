export const EMAIL_CONFIG = {
  SMTP: {
    HOST: 'smtp.gmail.com',
    PORT: 465,
    USER: process.env.SMTP_USER || 'marklasfar@gmail.com',
    PASS: process.env.SMTP_PASS,
    SECURE: true,
  },
  FROM: {
    NAME: 'MGZon',
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
    CODE_EXPIRY: 600000,
    MAX_ATTEMPTS: 5,
  },
};