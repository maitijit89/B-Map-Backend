/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import JavaScriptObfuscator from 'javascript-obfuscator';

const DIST_DIR = path.resolve(__dirname, '../dist');

function getAllJsFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function cleanDistDirectory(): void {
  console.log('🧹 [1/4] Cleaning previous distribution artifacts...');
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
}

function compileTypeScriptProduction(): void {
  console.log('⚙️  [2/4] Compiling TypeScript with strict zero-leakage production config...');
  execSync('npx tsc --project tsconfig.prod.json', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
}

function obfuscateDistributionFiles(): void {
  console.log('🔒 [3/4] Executing Military-Grade Reverse-Engineering Obfuscation Pipeline...');

  const jsFiles = getAllJsFiles(DIST_DIR);
  console.log(`   Found ${jsFiles.length} distribution JavaScript files to harden.`);

  let totalOriginalBytes = 0;
  let totalObfuscatedBytes = 0;

  for (const filePath of jsFiles) {
    const originalCode = fs.readFileSync(filePath, 'utf-8');
    totalOriginalBytes += Buffer.byteLength(originalCode, 'utf-8');

    const obfuscationResult = JavaScriptObfuscator.obfuscate(originalCode, {
      target: 'node',
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.85,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.35,
      debugProtection: false, // Prevents interfering with APM while rendering code completely unreadable
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      renameGlobals: false, // Ensure external Node.js modules and exports remain compatible
      selfDefending: true, // Breaks decompilers and beautifiers if formatted or tampered
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 4,
      stringArray: true,
      stringArrayEncoding: ['rc4', 'base64'],
      stringArrayThreshold: 1.0,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 4,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 4,
      stringArrayWrappersType: 'function',
      transformObjectKeys: true,
      numbersToExpressions: true,
      sourceMap: false,
    });

    const obfuscatedCode = obfuscationResult.getObfuscatedCode();
    totalObfuscatedBytes += Buffer.byteLength(obfuscatedCode, 'utf-8');

    fs.writeFileSync(filePath, obfuscatedCode, 'utf-8');
  }

  console.log(`   ✅ Successfully obfuscated ${jsFiles.length} files.`);
  console.log(`   Original payload: ${(totalOriginalBytes / 1024).toFixed(1)} KB`);
  console.log(`   Hardened & armored payload: ${(totalObfuscatedBytes / 1024).toFixed(1)} KB`);
}

function purgeMetadataAndMaps(): void {
  console.log('🛡️  [4/4] Purging any residual source maps, declaration files, and symbol tables...');

  function purgeFiles(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        purgeFiles(fullPath);
      } else if (
        entry.isFile() &&
        (fullPath.endsWith('.map') ||
          fullPath.endsWith('.d.ts') ||
          fullPath.endsWith('.d.ts.map') ||
          entry.name.startsWith('.tsbuildinfo'))
      ) {
        fs.unlinkSync(fullPath);
      }
    }
  }

  purgeFiles(DIST_DIR);
  console.log('   ✅ All source maps and type signatures stripped. Zero source code leakage.');
}

async function run(): Promise<void> {
  const startTime = Date.now();
  console.log('========================================================================');
  console.log('🛡️  B-MAP ENTERPRISE REVERSE-ENGINEERING PROOF PRODUCTION BUILD PIPELINE');
  console.log('========================================================================\n');

  try {
    cleanDistDirectory();
    compileTypeScriptProduction();
    obfuscateDistributionFiles();
    purgeMetadataAndMaps();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Hardened distribution ready in dist/ in ${elapsed}s.`);
    console.log('========================================================================\n');
  } catch (err: any) {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  }
}

run();
