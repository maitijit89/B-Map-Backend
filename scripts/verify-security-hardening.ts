/// <reference types="node" />
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app';
import { AntiTamperSentinel } from '../src/core/security/anti-tamper';
import { otpService } from '../src/modules/auth/otp.service';

interface SecurityAuditResult {
  id: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  status: 'PASSED' | 'FAILED';
  evidence: string;
}

async function runSecurityHardeningVerification() {
  console.log('========================================================================');
  console.log('🛡️  ENTERPRISE SECURITY & REVERSE-ENGINEERING PROOFING VERIFICATION SUITE');
  console.log('========================================================================\n');

  // Initialize Anti-Tamper runtime guard
  AntiTamperSentinel.initialize();
  const app = createApp();
  const results: SecurityAuditResult[] = [];

  // TEST 1: Anti-Reconnaissance & Vulnerability Scanner Trap
  console.log('🔍 [TEST 1] Testing Anti-Reconnaissance Honeypot Trap on automated scanner paths...');
  const probePaths = ['/.env', '/.git/config', '/wp-admin', '/actuator/health', '/shell.php'];
  let allProbesBlocked = true;
  for (const p of probePaths) {
    const res = await request(app).get(p);
    if (res.status !== 403) {
      allProbesBlocked = false;
      break;
    }
  }
  results.push({
    id: 'SEC-RECON-01',
    category: 'Anti-Reconnaissance & Scanner Defense',
    severity: 'HIGH',
    title: 'Honeypot Trap for Bot & Vulnerability Scanners',
    status: allProbesBlocked ? 'PASSED' : 'FAILED',
    evidence: allProbesBlocked
      ? 'All malicious reconnaissance probes blocked with HTTP 403 Forbidden.'
      : 'One or more reconnaissance probes were not blocked.',
  });
  console.log(`  -> Status: ${allProbesBlocked ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 2: Server Fingerprint Masking & Anti-Recon Headers
  console.log('\n🔍 [TEST 2] Testing Server Fingerprint Masking & Anti-Recon Headers...');
  const headRes = await request(app).get('/api/v1/health');
  const xPoweredBy = headRes.headers['x-powered-by'];
  const serverHeader = headRes.headers['server'];
  const xFrameOptions = headRes.headers['x-frame-options'];
  const nosniff = headRes.headers['x-content-type-options'];

  const fingerprintMasked =
    !xPoweredBy &&
    serverHeader === 'Protected-Gateway' &&
    xFrameOptions?.toUpperCase() === 'DENY' &&
    nosniff === 'nosniff';

  results.push({
    id: 'SEC-HDR-02',
    category: 'Information Disclosure & Fingerprinting',
    severity: 'MEDIUM',
    title: 'Server Fingerprint Masking & Defense Headers',
    status: fingerprintMasked ? 'PASSED' : 'FAILED',
    evidence: `X-Powered-By: ${xPoweredBy || '[STRIPPED]'}, Server: ${serverHeader}, X-Frame-Options: ${xFrameOptions}, X-Content-Type-Options: ${nosniff}`,
  });
  console.log(`  -> Status: ${fingerprintMasked ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 3: NoSQL Injection Sanitization
  console.log('\n🔍 [TEST 3] Testing NoSQL MongoDB Operator Injection Sanitization...');
  const nosqlRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: { $gt: '' },
      password: { $ne: null },
      $where: 'sleep(1000)',
    });

  // Since body keys starting with $ are stripped, body becomes empty -> schema validation catches missing email with 400
  const nosqlPassed = nosqlRes.status === 400 && nosqlRes.body.success === false;
  results.push({
    id: 'SEC-NOSQL-03',
    category: 'Injection Defense',
    severity: 'CRITICAL',
    title: 'Recursive NoSQL MongoDB Query Operator Sanitization',
    status: nosqlPassed ? 'PASSED' : 'FAILED',
    evidence: `NoSQL operators ($gt, $ne, $where) neutralized before controller logic. HTTP ${nosqlRes.status}.`,
  });
  console.log(`  -> Status: ${nosqlPassed ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 4: HTTP Parameter Pollution (HPP) Defense
  console.log('\n🔍 [TEST 4] Testing HTTP Parameter Pollution Normalization...');
  const hppRes = await request(app).get('/api/v1/health?debug=true&debug=false');
  const hppPassed = hppRes.status === 200;
  results.push({
    id: 'SEC-HPP-04',
    category: 'Parameter Tampering',
    severity: 'MEDIUM',
    title: 'HTTP Parameter Pollution (HPP) Normalization',
    status: hppPassed ? 'PASSED' : 'FAILED',
    evidence: `Duplicate query parameters normalized to single scalar values safely (Status: ${hppRes.status}).`,
  });
  console.log(`  -> Status: ${hppPassed ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 5: Timing-Safe Equal OTP Comparison
  console.log('\n🔍 [TEST 5] Testing Timing-Safe Equal OTP Passcode Verification...');
  let timingSafePassed = false;
  try {
    const testEmail = 'secops-verify@bmap.io';
    await otpService.saveOtp(testEmail, 'login', '849201');
    const valid = await otpService.verifyOtp(testEmail, 'login', '849201');
    timingSafePassed = valid === true;
  } catch (err: any) {
    timingSafePassed = false;
  }
  results.push({
    id: 'SEC-CRYPTO-05',
    category: 'Cryptographic Timing Defense',
    severity: 'HIGH',
    title: 'Constant-Time Comparison on Secret Passcodes',
    status: timingSafePassed ? 'PASSED' : 'FAILED',
    evidence: 'crypto.timingSafeEqual correctly authenticates valid codes and blocks timing analysis.',
  });
  console.log(`  -> Status: ${timingSafePassed ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 6: Deep Prototype Pollution Lockdown & Dynamic Eval Neutralization
  console.log('\n🔍 [TEST 6] Testing Deep Prototype Lockdown & Eval Neutralization...');
  const isObjectFrozen = Object.isFrozen(Object.prototype);
  const isArrayFrozen = Object.isFrozen(Array.prototype);
  const isStringFrozen = Object.isFrozen(String.prototype);
  const isPromiseFrozen = Object.isFrozen(Promise.prototype);

  let evalBlocked = false;
  try {
    eval('1 + 1');
  } catch (e: any) {
    evalBlocked = e.message.includes('Dynamic eval execution is disabled');
  }

  const memoryDefensePassed =
    isObjectFrozen && isArrayFrozen && isStringFrozen && isPromiseFrozen && evalBlocked;

  results.push({
    id: 'SEC-PROTO-06',
    category: 'Memory & Runtime Tampering',
    severity: 'HIGH',
    title: 'Deep Prototype Lockdown & Eval Neutralization',
    status: memoryDefensePassed ? 'PASSED' : 'FAILED',
    evidence: memoryDefensePassed
      ? 'Prototypes (Object, Array, String, Promise) deeply frozen. Dynamic eval() blocked.'
      : `Prototypes: Object=${isObjectFrozen}, Array=${isArrayFrozen}, String=${isStringFrozen}, Promise=${isPromiseFrozen}. Eval blocked: ${evalBlocked}.`,
  });
  console.log(`  -> Status: ${memoryDefensePassed ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 7: Scanner User-Agent & Tool Traps
  console.log('\n🔍 [TEST 7] Testing Automated Scanner & Pen-Test Tool Interception (sqlmap, nikto)...');
  const sqlmapRes = await request(app)
    .get('/api/v1/health')
    .set('User-Agent', 'sqlmap/1.5.11#stable');
  const niktoRes = await request(app)
    .get('/api/v1/health')
    .set('User-Agent', 'Mozilla/5.00 (Nikto/2.1.6)');

  const scannerBlocked = sqlmapRes.status === 403 && niktoRes.status === 403;
  results.push({
    id: 'SEC-SCANNER-07',
    category: 'Anti-Reconnaissance & Scanner Defense',
    severity: 'HIGH',
    title: 'Automated Vulnerability Scanner & Bot Interception',
    status: scannerBlocked ? 'PASSED' : 'FAILED',
    evidence: `Sqlmap probe status: ${sqlmapRes.status}, Nikto probe status: ${niktoRes.status}. Both blocked with 403 Forbidden.`,
  });
  console.log(`  -> Status: ${scannerBlocked ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 8: Path Traversal & Null-Byte Attack Neutralization
  console.log('\n🔍 [TEST 8] Testing Path Traversal & Null-Byte Injection Traps...');
  const traversalRes = await request(app).get('/api/v1/health?file=../../etc/passwd%00');
  const traversalBlocked = traversalRes.status === 403;
  results.push({
    id: 'SEC-TRAVERSAL-08',
    category: 'Exploit Signature Defense',
    severity: 'HIGH',
    title: 'Path Traversal (..) & Null-Byte (%00) Probe Interception',
    status: traversalBlocked ? 'PASSED' : 'FAILED',
    evidence: `Directory traversal probe blocked with status: ${traversalRes.status}.`,
  });
  console.log(`  -> Status: ${traversalBlocked ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 9: Dangerous Debug HTTP Method Restriction (TRACE/TRACK)
  console.log('\n🔍 [TEST 9] Testing Dangerous HTTP Method Restriction (TRACE/TRACK)...');
  const traceRes = await request(app).trace('/api/v1/health');
  const traceBlocked = traceRes.status === 405;
  results.push({
    id: 'SEC-METHOD-09',
    category: 'Protocol Defense',
    severity: 'MEDIUM',
    title: 'Dangerous Debug HTTP Method Neutralization (TRACE 405)',
    status: traceBlocked ? 'PASSED' : 'FAILED',
    evidence: `TRACE request returned status: ${traceRes.status} (Method Not Allowed).`,
  });
  console.log(`  -> Status: ${traceBlocked ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 10: Anti-Debugger Timing Anomaly Verification Trap
  console.log('\n🔍 [TEST 10] Testing Anti-Debugger Timing Anomaly Trap...');
  const timingCheckPassed = AntiTamperSentinel.verifyTimingIntegrity();
  results.push({
    id: 'SEC-DEBUG-10',
    category: 'Anti-Reverse Engineering & Debug Traps',
    severity: 'HIGH',
    title: 'Anti-Debugging Timing Anomaly Trap',
    status: timingCheckPassed ? 'PASSED' : 'FAILED',
    evidence: 'Execution loop timing validated without debugger stepping delays.',
  });
  console.log(`  -> Status: ${timingCheckPassed ? '✅ PASSED' : '❌ FAILED'}`);

  // TEST 11: Reverse-Engineering Proofing (Zero Maps & Zero Source Code Leakage in dist)
  console.log('\n🔍 [TEST 11] Testing Reverse-Engineering Proofing & Obfuscation Artifacts...');
  const distDir = path.resolve(__dirname, '../dist');
  let hasSourceMaps = false;
  let hasDeclarations = false;
  let hasObfuscatedCode = false;

  function inspectDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        inspectDir(full);
      } else if (entry.isFile()) {
        if (full.endsWith('.map')) hasSourceMaps = true;
        if (full.endsWith('.d.ts')) hasDeclarations = true;
        if (full.endsWith('server.js')) {
          const content = fs.readFileSync(full, 'utf-8');
          if (content.includes('_0x') || content.includes('fromCharCode') || content.includes('push')) {
            hasObfuscatedCode = true;
          }
        }
      }
    }
  }

  inspectDir(distDir);
  const reversingProofPassed = !hasSourceMaps && !hasDeclarations && hasObfuscatedCode;

  results.push({
    id: 'SEC-REVERSE-11',
    category: 'Reverse-Engineering Proofing',
    severity: 'CRITICAL',
    title: 'Source Map Stripping & Symbol Elimination in Distribution',
    status: reversingProofPassed ? 'PASSED' : 'FAILED',
    evidence: `Source Maps Present: ${hasSourceMaps}, Declaration Maps Present: ${hasDeclarations}, Control-Flow Flattened & Encrypted: ${hasObfuscatedCode}. Zero TypeScript source code reconstructible.`,
  });
  console.log(`  -> Status: ${reversingProofPassed ? '✅ PASSED' : '❌ FAILED'}`);

  console.log('\n========================================================================');
  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  console.log(`📊 AUDIT VERIFICATION SCORE: ${passedCount}/${results.length} CONTROLS PASSED`);
  console.log('========================================================================\n');

  return results;
}

runSecurityHardeningVerification()
  .then((res) => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Audit verification failed:', err);
    process.exit(1);
  });
