import { Router } from 'express';
import { authRateLimiter } from '../../core/middlewares/rate-limit.middleware';
import { validateRequest } from '../../core/middlewares/validate.middleware';
import { authController } from './auth.controller';
import {
  loginRequestSchema,
  resendOtpSchema,
  signupSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from './auth.dto';
import { authenticateUser } from './auth.middleware';

const router = Router();

// Apply strict rate limiting to authentication routes to mitigate brute force & SMTP floods
router.use(authRateLimiter);

// ==========================================
// 1. REGISTRATION & EMAIL OTP VERIFICATION
// ==========================================

// Register with Name, Age, Email, Phone Number -> sends email OTP
router.post('/signup', validateRequest({ body: signupSchema }), (req, res) =>
  authController.signup(req, res)
);
router.post('/register', validateRequest({ body: signupSchema }), (req, res) =>
  authController.signup(req, res)
);

// Verify Registration Email OTP -> activates user & returns JWT
router.post(
  '/verify-registration-otp',
  validateRequest({ body: verifyOtpSchema }),
  (req, res) => authController.verifyRegistrationOtp(req, res)
);
router.post('/verify-email', validateRequest({ body: verifyOtpSchema }), (req, res) =>
  authController.verifyRegistrationOtp(req, res)
);

// ==========================================
// 2. PASSWORDLESS LOGIN VIA EMAIL OTP
// ==========================================

// Request Login OTP -> sends email OTP
router.post('/login', validateRequest({ body: loginRequestSchema }), (req, res) =>
  authController.requestLoginOtp(req, res)
);
router.post(
  '/request-login-otp',
  validateRequest({ body: loginRequestSchema }),
  (req, res) => authController.requestLoginOtp(req, res)
);

// Verify Login OTP -> returns JWT access token
router.post(
  '/verify-login-otp',
  validateRequest({ body: verifyOtpSchema }),
  (req, res) => authController.verifyLoginOtp(req, res)
);
router.post('/login/verify', validateRequest({ body: verifyOtpSchema }), (req, res) =>
  authController.verifyLoginOtp(req, res)
);

// ==========================================
// 3. OTP RESEND & COOLDOWN
// ==========================================
router.post('/resend-otp', validateRequest({ body: resendOtpSchema }), (req, res) =>
  authController.resendOtp(req, res)
);

// ==========================================
// 4. AUTHENTICATED USER SESSION & PROFILE
// ==========================================
router.get('/me', authenticateUser, (req, res) => authController.getMe(req, res));
router.put(
  '/me',
  authenticateUser,
  validateRequest({ body: updateProfileSchema }),
  (req, res) => authController.updateMe(req, res)
);
router.post('/logout', authenticateUser, (req, res) => authController.logout(req, res));

export default router;
