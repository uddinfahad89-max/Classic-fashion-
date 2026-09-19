export interface OtpResult {
  success: boolean;
  message?: string;
  code?: string;
}

class OtpService {
  private activeOtps: Map<string, { code: string; expiresAt: number }> = new Map();

  /**
   * Generates a 4-digit mock OTP code for the given phone number or email
   */
  generateOtp(targetIdentifier: string): string {
    const clean = targetIdentifier.trim().toLowerCase().replace(/[\s+-]/g, '');
    // 4-digit numeric code e.g. 1000 - 9999
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // valid for 5 minutes
    this.activeOtps.set(clean, { code, expiresAt });

    try {
      localStorage.setItem(`pos_mock_otp_${clean}`, JSON.stringify({ code, expiresAt }));
    } catch {
      // ignore storage quota errors
    }

    return code;
  }

  /**
   * Retrieves the current active 4-digit OTP code for display/auto-fill
   */
  getOtp(targetIdentifier: string): string | null {
    const clean = targetIdentifier.trim().toLowerCase().replace(/[\s+-]/g, '');
    const memoryEntry = this.activeOtps.get(clean);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      return memoryEntry.code;
    }

    try {
      const raw = localStorage.getItem(`pos_mock_otp_${clean}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.expiresAt > Date.now()) {
          return parsed.code;
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * Validates a 4-digit OTP. Accepts the generated code or universal test code '1234'
   */
  validateOtp(targetIdentifier: string, enteredCode: string): OtpResult {
    const cleanCode = enteredCode.trim();
    if (!cleanCode || cleanCode.length !== 4) {
      return {
        success: false,
        message: 'অনুগ্রহ করে ৪ ডিজিটের ওটিপি লিখুন (Enter 4-digit OTP code)',
      };
    }

    // Universal test OTP '1234' for fast instant access
    if (cleanCode === '1234') {
      return { success: true };
    }

    const clean = targetIdentifier.trim().toLowerCase().replace(/[\s+-]/g, '');
    const generated = this.getOtp(clean);

    if (generated && generated === cleanCode) {
      this.activeOtps.delete(clean);
      try {
        localStorage.removeItem(`pos_mock_otp_${clean}`);
      } catch {}
      return { success: true };
    }

    return {
      success: false,
      message: 'ওটিপি কোডটি সঠিক নয়! অনুগ্রহ করে সঠিক ৪-ডিজিট কোড দিন অথবা ১২৩৪ দিন।',
    };
  }
}

export const otpService = new OtpService();
