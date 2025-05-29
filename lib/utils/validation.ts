export const validation = {
    isValidEmail: (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
  
    isValidVerificationCode: (code: string): boolean => {
      return /^\d{6}$/.test(code);
    },
  
    isPasswordStrong: (password: string): boolean => {
      // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      return passwordRegex.test(password);
    },
  
    sanitizeEmail: (email: string): string => {
      return email.toLowerCase().trim();
    },
  
    validateVerificationAttempts: (
      attempts: number,
      lastAttempt?: Date
    ): { valid: boolean; timeRemaining?: number } => {
      if (attempts >= EMAIL_CONFIG.VERIFICATION.MAX_ATTEMPTS) {
        if (!lastAttempt) return { valid: false };
        
        const cooldownEnd = new Date(lastAttempt.getTime() + EMAIL_CONFIG.VERIFICATION.COOLDOWN);
        const now = new Date();
        
        if (now < cooldownEnd) {
          return {
            valid: false,
            timeRemaining: Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000)
          };
        }
      }
      return { valid: true };
    }
  };


  export const isValidUTCDateTime = (dateTime: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!regex.test(dateTime)) return false;
  
    const date = new Date(dateTime.replace(' ', 'T') + 'Z');
    return date.toString() !== 'Invalid Date';
  };