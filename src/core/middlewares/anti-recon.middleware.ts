import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

/**
 * Enterprise Anti-Reconnaissance & Vulnerability Scanner Trap.
 * Detects common probing patterns from automated bots, vulnerability scanners,
 * path traversal attacks, and reverse-engineering toolkits.
 */
const SUSPICIOUS_PATHS = [
  '/.env',
  '/.git',
  '/.aws',
  '/wp-admin',
  '/wp-login.php',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/pma',
  '/actuator',
  '/solr',
  '/shell',
  '/cgi-bin',
  '/etc/passwd',
  '/proc/self',
  '/config.json',
  '/credentials',
  '/id_rsa',
  '/.ds_store',
  '/web.config',
  '/debug/default',
  '/.well-known/security.txt',
];

const SCANNER_USER_AGENTS = [
  'sqlmap',
  'nikto',
  'acunetix',
  'dirbuster',
  'gobuster',
  'ffuf',
  'masscan',
  'nmap',
  'zgrab',
  'censys',
  'shodan',
  'wpscan',
  'havij',
  'nessus',
  'openvas',
];

const DANGEROUS_METHODS = ['TRACE', 'TRACK', 'CONNECT'];

export const antiReconTrap = (req: Request, res: Response, next: NextFunction): void => {
  // 1. Block dangerous / debug HTTP methods
  if (DANGEROUS_METHODS.includes(req.method.toUpperCase())) {
    res.status(405).json({
      success: false,
      statusCode: 405,
      message: 'Method Not Allowed: HTTP method restricted by defense layer.',
    });
    return;
  }

  const normalizedPath = (req.path || '').toLowerCase();
  const rawUrl = (req.originalUrl || '').toLowerCase();
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // 2. Automated Scanner User-Agent Detection
  const hasScannerAgent = SCANNER_USER_AGENTS.some((agent) => userAgent.includes(agent));
  if (hasScannerAgent) {
    logger.warn(`🚨 Anti-Reconnaissance Trap: Blocked automated scanner User-Agent [${userAgent}] from IP [${clientIp}]`);
    res.status(403).json({
      success: false,
      statusCode: 403,
      message: 'Access Denied: Automated security scanning tool detected and blocked.',
    });
    return;
  }

  // 3. Honeypot Path Inspection
  const isSuspiciousPath = SUSPICIOUS_PATHS.some((trap) => normalizedPath.includes(trap));

  // 4. Path Traversal & Null-Byte Injection Traps
  const hasPathTraversalOrNullByte =
    rawUrl.includes('..') ||
    rawUrl.includes('%2e%2e') ||
    rawUrl.includes('%00') ||
    rawUrl.includes('\\0') ||
    rawUrl.includes('/etc/') ||
    rawUrl.includes('boot.ini');

  if (isSuspiciousPath || hasPathTraversalOrNullByte) {
    logger.warn(`🚨 Anti-Reconnaissance Trap triggered: Blocked probe [${req.originalUrl}] from IP [${clientIp}]`);

    res.status(403).json({
      success: false,
      statusCode: 403,
      message: 'Access Denied: Suspicious activity detected by security defense layer.',
    });
    return;
  }

  next();
};

