import { env } from '../src/core/config/env.config';
import { cloudinaryService } from '../src/services/cloudinary.service';
import { googleMapsService } from '../src/services/google-maps.service';
import { mailerService } from '../src/services/mailer.service';
import { keepaliveService } from '../src/services/keepalive.service';

async function testCredentialsIntegration() {
  console.log('====================================================');
  console.log('🧪 B-MAP CREDENTIALS & SERVICE INTEGRATION TEST SUITE');
  console.log('====================================================\n');

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

  // 1. App & Environment Validation
  console.log('--- 1. App Configuration ---');
  assert(env.APP_ENV === 'development', 'APP_ENV is development', env.APP_ENV);
  assert(env.APP_PORT === 8080 && env.PORT === 8080, 'Port mapped to 8080', `APP_PORT: ${env.APP_PORT}, PORT: ${env.PORT}`);
  assert(env.APP_NAME === 'B Map', 'APP_NAME is "B Map"', env.APP_NAME);
  assert(env.APP_URL === 'http://localhost:8080', 'APP_URL is http://localhost:8080', env.APP_URL);
  assert(env.APP_VERSION === '1.0.0', 'APP_VERSION is 1.0.0', env.APP_VERSION);

  // 2. JWT Configuration
  console.log('\n--- 2. JWT Configuration ---');
  assert(env.JWT_SECRET.length > 20, 'JWT_SECRET is loaded', `${env.JWT_SECRET.substring(0, 8)}...`);
  assert(env.JWT_EXPIRY_HOURS === 72, 'JWT_EXPIRY_HOURS parsed as 72 hours', `${env.JWT_EXPIRY_HOURS} hours`);

  // 3. Admin & Database Configuration
  console.log('\n--- 3. Database & Admin Configuration ---');
  assert(env.ADMIN_EMAIL === 'maitidebjit2@gmail.com', 'ADMIN_EMAIL is maitidebjit2@gmail.com', env.ADMIN_EMAIL);
  assert(env.MONGODB_URI.startsWith('mongodb+srv://'), 'MONGODB_URI is valid Atlas SRV string', `${env.MONGODB_URI.substring(0, 25)}...`);
  assert(env.DB_HOST === 'cluster0.s6zrwkc.mongodb.net', 'DB_HOST parsed properly', env.DB_HOST);
  assert(env.DB_NAME === 'b_map_db', 'DB_NAME matches', env.DB_NAME);
  assert(env.DB_USER === 'maitidebjit2_db_user', 'DB_USER configured', env.DB_USER);

  // 4. Redis Cache Configuration (Upstash Cloud TLS)
  console.log('\n--- 4. Redis Cache (Upstash Cloud) ---');
  assert(env.REDIS_URL.startsWith('rediss://'), 'REDIS_URL uses TLS protocol (rediss://)', `${env.REDIS_URL.substring(0, 20)}...`);
  assert(env.REDIS_HOST === 'national-bug-258874.upstash.io', 'REDIS_HOST matches Upstash endpoint', env.REDIS_HOST);
  assert(env.REDIS_PORT === 6379, 'REDIS_PORT is 6379', `${env.REDIS_PORT}`);
  assert(env.OTP_EXPIRY_MINUTES === 5, 'OTP_EXPIRY_MINUTES is 5', `${env.OTP_EXPIRY_MINUTES} mins`);

  // 5. Cloudinary Storage Configuration
  console.log('\n--- 5. Cloudinary Storage ---');
  assert(env.CLOUDINARY_CLOUD_NAME === 'jon6vask', 'CLOUDINARY_CLOUD_NAME is jon6vask', env.CLOUDINARY_CLOUD_NAME);
  assert(env.CLOUDINARY_API_KEY === '439324579931125', 'CLOUDINARY_API_KEY is configured', env.CLOUDINARY_API_KEY);
  assert(cloudinaryService.isConfigured(), 'Cloudinary service isConfigured() returns true');
  
  const uploadSig = cloudinaryService.generateUploadSignature({ folder: env.CLOUDINARY_FOLDER });
  assert(Boolean(uploadSig.signature && uploadSig.apiKey), 'Cloudinary SHA-1 upload signature successfully generated', `Signature: ${uploadSig.signature.substring(0, 10)}...`);
  const cdnUrl = cloudinaryService.getOptimizedUrl('sample_poi_photo', { width: 800, height: 600 });
  assert(cdnUrl.includes('res.cloudinary.com/jon6vask/image/upload'), 'Cloudinary CDN transform URL generated', cdnUrl);

  // 6. Google Maps Platform
  console.log('\n--- 6. Google Maps Platform ---');
  assert(env.GOOGLE_MAPS_API_KEY.startsWith('AIzaSy'), 'GOOGLE_MAPS_API_KEY is valid key format', `${env.GOOGLE_MAPS_API_KEY.substring(0, 10)}...`);
  assert(env.GOOGLE_PLACES_API_KEY.startsWith('AIzaSy'), 'GOOGLE_PLACES_API_KEY is configured', `${env.GOOGLE_PLACES_API_KEY.substring(0, 10)}...`);
  assert(env.GOOGLE_MAPS_API_SECRET.length > 10, 'GOOGLE_MAPS_API_SECRET is configured', `${env.GOOGLE_MAPS_API_SECRET.substring(0, 8)}...`);

  // 7. SMTP Gmail Delivery
  console.log('\n--- 7. SMTP Gmail Delivery ---');
  assert(env.SMTP_HOST === 'smtp.gmail.com', 'SMTP_HOST is smtp.gmail.com', env.SMTP_HOST);
  assert(env.SMTP_PORT === 587, 'SMTP_PORT is 587', `${env.SMTP_PORT}`);
  assert(env.SMTP_USERNAME === 'maitidebjit2@gmail.com', 'SMTP_USERNAME is maitidebjit2@gmail.com', env.SMTP_USERNAME);
  assert(env.SMTP_FROM_NAME === 'B Map', 'SMTP_FROM_NAME is B Map', env.SMTP_FROM_NAME);
  
  const otpDispatched = await mailerService.sendOtpEmail('recipient@example.com', '984512', 'Registration');
  assert(otpDispatched === true, 'Mailer service sendOtpEmail processed dispatch', 'OTP: 984512');

  // 8. Server Keep-Alive / Anti-Sleep Heartbeat
  console.log('\n--- 8. Keep-Alive / Anti-Sleep Heartbeat ---');
  assert(env.KEEPALIVE_ENABLED === true, 'KEEPALIVE_ENABLED parsed as true boolean');
  assert(env.KEEPALIVE_INTERVAL_MINUTES === 2, 'KEEPALIVE_INTERVAL_MINUTES parsed as 2 minutes', `${env.KEEPALIVE_INTERVAL_MINUTES}m`);
  
  const status = keepaliveService.getStatus();
  assert(status.isEnabled === true && status.intervalMinutes === 2, 'KeepAliveService status matches env settings', status.targetUrl);

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL CREDENTIALS & SERVICE INTEGRATIONS VALIDATED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('💥 Some credentials validations failed.');
    process.exit(1);
  }
}

testCredentialsIntegration().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
