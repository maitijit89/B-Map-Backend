import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/core/config/database';
import { env } from '../src/core/config/env.config';
import { jwtService } from '../src/modules/auth/jwt.service';
import { otpService } from '../src/modules/auth/otp.service';
import { User } from '../src/modules/auth/user.model';

async function runAuthTest() {
  console.log('====================================================');
  console.log('🔐 B-MAP USER REGISTRATION & EMAIL OTP AUTH TEST SUITE');
  console.log('====================================================\n');

  const app = createApp();
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  // Attempt real MongoDB Atlas connection first
  try {
    await connectDatabase();
  } catch (err) {
    // Graceful fallback
  }

  const isMongoConnected = mongoose.connection.readyState === 1;
  const mockStore = new Map<string, any>();

  if (isMongoConnected) {
    console.log('🌐 Connected to live MongoDB Atlas for authentication tests.');
  } else {
    console.log('ℹ️ Running in memory-stubbed model mode for offline resilience...');
    
    // Disable Mongoose command buffering when offline
    mongoose.set('bufferCommands', false);

    User.findOne = ((query: any) => {
      const email = query.email?.toLowerCase();
      const user = mockStore.get(email) || null;
      return Promise.resolve(user);
    }) as any;

    User.findById = ((id: any) => {
      for (const user of mockStore.values()) {
        if (user._id?.toString() === id.toString()) return Promise.resolve(user);
      }
      return Promise.resolve(null);
    }) as any;

    User.prototype.save = function () {
      if (!this._id) {
        this._id = new mongoose.Types.ObjectId();
      }
      mockStore.set(this.email.toLowerCase(), this);
      return Promise.resolve(this);
    };
  }

  const testEmail = `test.user.${Date.now()}@example.com`;
  const testName = 'Aarav Sharma';
  const testAge = 26;
  const testNumber = '+919876543210';

  console.log(`👤 Test Candidate: ${testName} (${testEmail}, Age: ${testAge}, Phone: ${testNumber})`);

  // --- TEST 1: Validation rejection on invalid signup payload ---
  console.log('\n--- 1. Signup Request Validation ---');
  const invalidRes = await request(app)
    .post(`${env.API_PREFIX}/auth/signup`)
    .send({ name: 'A', age: 150, email: 'not-an-email' }); // Missing phone, invalid age & email
  
  assert(invalidRes.status === 400, 'Rejects invalid signup parameters with 400', invalidRes.body.message);

  // --- TEST 2: Valid Signup with Name, Age, Email, Number ---
  console.log('\n--- 2. Valid User Registration Flow ---');
  const signupRes = await request(app)
    .post(`${env.API_PREFIX}/auth/signup`)
    .send({
      name: testName,
      age: testAge,
      email: testEmail,
      number: testNumber,
    });

  assert(signupRes.status === 201, 'Signup creates pending user with 201 Created', signupRes.body.message);
  assert(signupRes.body.data?.email === testEmail.toLowerCase(), 'Response returns user email', signupRes.body.data?.email);
  assert(signupRes.body.data?.expiresInMinutes === 5, 'Response confirms OTP expiry in 5 mins', `${signupRes.body.data?.expiresInMinutes}m`);

  // --- TEST 3: Intercept & inspect generated OTP in cache ---
  console.log('\n--- 3. OTP Generation & Verification Logic ---');
  const generatedOtp = otpService.generateOtp();
  assert(/^\d{6}$/.test(generatedOtp), 'Generates valid 6-digit numeric OTP', `OTP: ${generatedOtp}`);

  // Re-save known OTP for deterministic test verification
  await otpService.saveOtp(testEmail, 'registration', '654321');

  // Submit wrong OTP to test attempt limiter
  const wrongOtpRes = await request(app)
    .post(`${env.API_PREFIX}/auth/verify-registration-otp`)
    .send({
      email: testEmail,
      otp: '000000',
    });
  
  assert(wrongOtpRes.status === 400, 'Rejects incorrect OTP passcode with 400', wrongOtpRes.body.message);
  assert(wrongOtpRes.body.message.includes('attempt(s) remaining'), 'Informs user of remaining attempts');

  // Submit correct OTP to complete email verification
  const correctOtpRes = await request(app)
    .post(`${env.API_PREFIX}/auth/verify-registration-otp`)
    .send({
      email: testEmail,
      otp: '654321',
    });

  assert(correctOtpRes.status === 200, 'Accepts valid OTP and completes verification', correctOtpRes.body.message);
  assert(Boolean(correctOtpRes.body.data?.token), 'Issues JWT authentication Bearer token', `${correctOtpRes.body.data?.token?.substring(0, 15)}...`);
  assert(correctOtpRes.body.data?.user?.isEmailVerified === true, 'User isEmailVerified flag set to TRUE');
  assert(correctOtpRes.body.data?.user?.name === testName, 'User profile returned with matching name', correctOtpRes.body.data?.user?.name);
  assert(correctOtpRes.body.data?.user?.age === testAge, 'User profile returned with matching age', `${correctOtpRes.body.data?.user?.age}`);

  const authToken = correctOtpRes.body.data?.token;

  // --- TEST 4: JWT Token Decryption & Verification ---
  console.log('\n--- 4. JWT Token Integrity ---');
  const decoded = jwtService.verifyToken(authToken);
  assert(decoded.email === testEmail.toLowerCase(), 'Decoded JWT email matches candidate', decoded.email);
  assert(decoded.name === testName, 'Decoded JWT name matches candidate', decoded.name);

  // --- TEST 5: Protected Route Access (/api/v1/auth/me) ---
  console.log('\n--- 5. Protected Endpoint Access (/me) ---');
  const unauthRes = await request(app).get(`${env.API_PREFIX}/auth/me`);
  assert(unauthRes.status === 401, 'Rejects unauthenticated request with 401 Unauthorized');

  const authMeRes = await request(app)
    .get(`${env.API_PREFIX}/auth/me`)
    .set('Authorization', `Bearer ${authToken}`);

  assert(authMeRes.status === 200, 'Accepts valid Bearer token and returns profile', authMeRes.body.message);
  assert(authMeRes.body.data?.email === testEmail.toLowerCase(), 'Profile matches authenticated user');

  // --- TEST 6: Login Flow via Email OTP ---
  console.log('\n--- 6. Passwordless Login via Email OTP Flow ---');
  const loginReqRes = await request(app)
    .post(`${env.API_PREFIX}/auth/login`)
    .send({ email: testEmail });

  assert(loginReqRes.status === 200, 'Request login OTP succeeds with 200 OK', loginReqRes.body.message);

  // Seed known login OTP for deterministic test
  await otpService.saveOtp(testEmail, 'login', '876543');

  const loginVerifyRes = await request(app)
    .post(`${env.API_PREFIX}/auth/verify-login-otp`)
    .send({
      email: testEmail,
      otp: '876543',
    });

  assert(loginVerifyRes.status === 200, 'Login OTP verification succeeds and returns JWT', loginVerifyRes.body.message);
  assert(Boolean(loginVerifyRes.body.data?.token), 'Login response contains new Bearer session token');

  // --- TEST 7: Resend OTP Cooldown ---
  console.log('\n--- 7. Resend OTP & Cooldown Enforcement ---');
  const resendCooldownRes = await request(app)
    .post(`${env.API_PREFIX}/auth/resend-otp`)
    .send({ email: testEmail, type: 'login' });

  // It should be within cooldown (< 30 seconds since previous send)
  assert(
    resendCooldownRes.status === 400 && resendCooldownRes.body.message.includes('seconds'),
    'Enforces 30-second cooldown on OTP resend requests',
    resendCooldownRes.body.message
  );

  // --- TEST 8: Update Profile Endpoint ---
  console.log('\n--- 8. Update Profile (/me) ---');
  const updateRes = await request(app)
    .put(`${env.API_PREFIX}/auth/me`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      name: 'Aarav V. Sharma',
      age: 27,
    });

  assert(updateRes.status === 200, 'Profile updated successfully', updateRes.body.message);
  assert(updateRes.body.data?.name === 'Aarav V. Sharma', 'Updated name reflected', updateRes.body.data?.name);
  assert(updateRes.body.data?.age === 27, 'Updated age reflected', `${updateRes.body.data?.age}`);

  // --- TEST 9: Logout Endpoint ---
  console.log('\n--- 9. Logout Session ---');
  const logoutRes = await request(app)
    .post(`${env.API_PREFIX}/auth/logout`)
    .set('Authorization', `Bearer ${authToken}`);

  assert(logoutRes.status === 200, 'Logout terminates session with 200 OK', logoutRes.body.message);

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================');

  if (isMongoConnected) {
    await disconnectDatabase();
  }

  if (passedTests === totalTests) {
    console.log('🎉 REGISTRATION & EMAIL OTP AUTHENTICATION SYSTEM FULLY VALIDATED!');
    process.exit(0);
  } else {
    console.error('💥 Some auth tests failed.');
    process.exit(1);
  }
}

runAuthTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
