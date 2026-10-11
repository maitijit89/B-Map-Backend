import { env } from '../../core/config/env.config';
import { logger } from '../../core/config/logger';
import { mailerService } from '../../services/mailer.service';
import { jwtService, JwtUserPayload } from './jwt.service';
import { otpService } from './otp.service';
import { IUser, User } from './user.model';

export interface UserResponseDto {
  id: string;
  name: string;
  age: number;
  email: string;
  phoneNumber: string;
  isEmailVerified: boolean;
  role: 'user' | 'admin';
  avatar?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSuccessResult {
  user: UserResponseDto;
  token: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export class AuthService {
  /**
   * Sanitizes user model document for API responses.
   */
  private sanitizeUser(user: IUser): UserResponseDto {
    return {
      id: user._id.toString(),
      name: user.name,
      age: user.age,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 1. Register a new user with Name, Age, Email, Phone Number.
   * Generates a 6-digit OTP and delivers it to the user's email for verification.
   */
  async register(params: {
    name: string;
    age: number;
    email: string;
    phoneNumber?: string;
    number?: string;
  }): Promise<{ email: string; name: string; expiresInMinutes: number }> {
    const email = params.email.trim().toLowerCase();
    const phoneNumber = (params.phoneNumber || params.number || '').trim();

    // Check if an existing account is already verified
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.isEmailVerified) {
      throw new Error('An account with this email already exists. Please log in with your email OTP.');
    }

    let user: IUser;
    if (existingUser && !existingUser.isEmailVerified) {
      // Re-use and update unverified registration profile
      existingUser.name = params.name.trim();
      existingUser.age = params.age;
      existingUser.phoneNumber = phoneNumber;
      user = await existingUser.save();
      logger.info(`Updated pending unverified account profile for: ${email}`);
    } else {
      // Create new user profile
      const role = email === env.ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';
      user = new User({
        name: params.name.trim(),
        age: params.age,
        email,
        phoneNumber,
        isEmailVerified: false,
        role,
      });
      await user.save();
      logger.info(`Created new user registration record for: ${email}`);
    }

    // Generate 6-digit OTP passcode
    const otp = otpService.generateOtp();

    // Save in Redis / in-memory cache with TTL
    await otpService.saveOtp(email, 'registration', otp);

    // Send verification email via Gmail SMTP
    await mailerService.sendOtpEmail(email, otp, 'Verification');

    return {
      email,
      name: user.name,
      expiresInMinutes: env.OTP_EXPIRY_MINUTES,
    };
  }

  /**
   * 2. Verify registration email OTP and activate account.
   */
  async verifyRegistrationOtp(emailInput: string, otp: string): Promise<AuthSuccessResult> {
    const email = emailInput.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('No registration found for this email address. Please register first.');
    }

    // Validate the OTP
    await otpService.verifyOtp(email, 'registration', otp);

    // Activate the user
    user.isEmailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = jwtService.generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    logger.info(`✅ User [${email}] successfully verified email and authenticated.`);

    return {
      user: this.sanitizeUser(user),
      token,
      tokenType: 'Bearer',
      expiresIn: `${env.JWT_EXPIRY_HOURS}h`,
    };
  }

  /**
   * 3. Request a login OTP passcode via email.
   */
  async requestLoginOtp(
    emailInput: string
  ): Promise<{ email: string; expiresInMinutes: number; needsVerification?: boolean }> {
    const email = emailInput.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('No account found with this email. Please create an account first.');
    }

    // If registered but not verified yet, send verification OTP
    if (!user.isEmailVerified) {
      const verifyOtp = otpService.generateOtp();
      await otpService.saveOtp(email, 'registration', verifyOtp);
      await mailerService.sendOtpEmail(email, verifyOtp, 'Verification');

      return {
        email,
        expiresInMinutes: env.OTP_EXPIRY_MINUTES,
        needsVerification: true,
      };
    }

    // Generate login OTP
    const otp = otpService.generateOtp();
    await otpService.saveOtp(email, 'login', otp);

    // Send OTP to user's email
    await mailerService.sendOtpEmail(email, otp, 'Login');

    return {
      email,
      expiresInMinutes: env.OTP_EXPIRY_MINUTES,
    };
  }

  /**
   * 4. Verify login OTP and issue JWT access token.
   */
  async verifyLoginOtp(emailInput: string, otp: string): Promise<AuthSuccessResult> {
    const email = emailInput.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('No account found with this email.');
    }

    // Verify OTP
    await otpService.verifyOtp(email, 'login', otp);

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = jwtService.generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    logger.info(`✅ User [${email}] successfully logged in via OTP.`);

    return {
      user: this.sanitizeUser(user),
      token,
      tokenType: 'Bearer',
      expiresIn: `${env.JWT_EXPIRY_HOURS}h`,
    };
  }

  /**
   * 5. Resend OTP with cooldown enforcement.
   */
  async resendOtp(
    emailInput: string,
    type: 'registration' | 'login'
  ): Promise<{ email: string; type: string; expiresInMinutes: number }> {
    const email = emailInput.trim().toLowerCase();

    // Cooldown check
    const cooldown = otpService.checkResendCooldown(email, type);
    if (!cooldown.canResend) {
      throw new Error(`Please wait ${cooldown.waitSeconds} seconds before requesting a new passcode.`);
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('No account found for this email address.');
    }

    const otp = otpService.generateOtp();
    await otpService.saveOtp(email, type, otp);

    const purpose = type === 'registration' ? 'Verification' : 'Login';
    await mailerService.sendOtpEmail(email, otp, purpose);

    return {
      email,
      type,
      expiresInMinutes: env.OTP_EXPIRY_MINUTES,
    };
  }

  /**
   * 6. Fetch currently logged-in user profile.
   */
  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User profile not found.');
    }
    return this.sanitizeUser(user);
  }

  /**
   * 7. Update user profile.
   */
  async updateProfile(
    userId: string,
    updates: { name?: string; age?: number; phoneNumber?: string; avatar?: string }
  ): Promise<UserResponseDto> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User profile not found.');
    }

    if (updates.name) user.name = updates.name.trim();
    if (updates.age !== undefined) user.age = updates.age;
    if (updates.phoneNumber) user.phoneNumber = updates.phoneNumber.trim();
    if (updates.avatar) user.avatar = updates.avatar.trim();

    await user.save();
    return this.sanitizeUser(user);
  }
}

export const authService = new AuthService();
