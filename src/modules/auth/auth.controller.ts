import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../core/utils/api-response';
import { AuthenticatedRequest } from './auth.middleware';
import { authService } from './auth.service';

export class AuthController {
  /**
   * POST /api/v1/auth/signup (or /register)
   * User registers with Name, Age, Email, Phone Number.
   * Dispatches verification OTP via Email.
   */
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const { name, age, email, phoneNumber, number } = req.body;
      const result = await authService.register({
        name,
        age,
        email,
        phoneNumber,
        number,
      });

      sendSuccess({
        res,
        statusCode: 201,
        message: 'Registration initiated successfully. Verification OTP has been sent to your email.',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/auth/verify-registration-otp (or /verify-email)
   * Verifies the email OTP sent during signup and activates user account with JWT.
   */
  async verifyRegistrationOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyRegistrationOtp(email, otp);

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Email verified successfully! Welcome to B-Map.',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/auth/login (or /request-login-otp)
   * Requests a secure one-time passcode for email-based login.
   */
  async requestLoginOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      const result = await authService.requestLoginOtp(email);

      const message = result.needsVerification
        ? 'Account requires email verification. Verification OTP has been sent to your email.'
        : 'Login OTP has been sent to your email.';

      sendSuccess({
        res,
        statusCode: 200,
        message,
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/auth/verify-login-otp (or /login/verify)
   * Verifies the login OTP and returns authenticated JWT session.
   */
  async verifyLoginOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyLoginOtp(email, otp);

      sendSuccess({
        res,
        statusCode: 200,
        message: 'Login successful! Welcome back.',
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/auth/resend-otp
   * Resends OTP passcode with cooldown protection.
   */
  async resendOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, type = 'login' } = req.body;
      const result = await authService.resendOtp(email, type);

      sendSuccess({
        res,
        statusCode: 200,
        message: `New ${type} OTP passcode dispatched to your email.`,
        data: result,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Fetches authenticated user's profile.
   */
  async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        sendError(res, 401, 'Unauthorized');
        return;
      }

      const profile = await authService.getCurrentUser(req.user.userId);
      sendSuccess({
        res,
        statusCode: 200,
        message: 'Profile retrieved successfully',
        data: profile,
      });
    } catch (error: any) {
      sendError(res, 404, error.message);
    }
  }

  /**
   * PUT /api/v1/auth/me
   * Updates authenticated user profile.
   */
  async updateMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.userId) {
        sendError(res, 401, 'Unauthorized');
        return;
      }

      const profile = await authService.updateProfile(req.user.userId, req.body);
      sendSuccess({
        res,
        statusCode: 200,
        message: 'Profile updated successfully',
        data: profile,
      });
    } catch (error: any) {
      sendError(res, 400, error.message);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Clears session.
   */
  async logout(_req: Request, res: Response): Promise<void> {
    sendSuccess({
      res,
      statusCode: 200,
      message: 'Logged out successfully',
    });
  }
}

export const authController = new AuthController();
