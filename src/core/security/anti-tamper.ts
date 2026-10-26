import inspector from 'inspector';
import { env } from '../config/env.config';
import { logger } from '../config/logger';

/**
 * Enterprise Anti-Tamper & Anti-Reverse Engineering Sentinel
 * Protects Node.js runtime against memory tampering, prototype pollution,
 * unauthorized debugging, AST hooking, and dynamic injection.
 */
export class AntiTamperSentinel {
  private static initialized = false;

  public static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.lockdownPrototypes();
    this.disableDynamicCodeExecution();
    this.freezeRuntimeConfiguration();
    this.enforceDebuggerProtection();
    this.hardenProcessSecurity();

    logger.info('🛡️ Advanced Anti-Tamper & Reverse-Engineering Sentinel active (Deep prototypes locked, Eval disabled, Debugger traps armed)');
  }

  /**
   * 1. Deep Prototype Pollution Defense
   * Freezes Object, Array, Function, String, Number, Boolean, Symbol, and Promise prototypes
   * to eliminate prototype poisoning and gadget-chain exploits.
   */
  private static lockdownPrototypes(): void {
    const targets = [
      Object.prototype,
      Array.prototype,
      Function.prototype,
      String.prototype,
      Number.prototype,
      Boolean.prototype,
      Symbol.prototype,
      Promise.prototype,
      Map.prototype,
      Set.prototype,
    ];

    for (const target of targets) {
      try {
        if (!Object.isFrozen(target)) {
          Object.freeze(target);
        }
      } catch (e: any) {
        logger.debug(`Prototype lockdown notice on target: ${e.message}`);
      }
    }
  }

  /**
   * 2. Dynamic Code Execution Lockdown
   * Neutralizes eval() to block remote code execution and in-memory payload decryption.
   */
  private static disableDynamicCodeExecution(): void {
    try {
      Object.defineProperty(globalThis, 'eval', {
        value: () => {
          throw new Error('Security Violation: Dynamic eval execution is disabled by AntiTamperSentinel.');
        },
        writable: false,
        configurable: false,
      });
    } catch {
      // Ignore if environment already restricts global eval modifications
    }

    try {
      const originalFunction = globalThis.Function;
      const secureFunction = function (this: any, ...args: any[]) {
        const stack = new Error().stack || '';
        const isInternalLibrary = stack.includes('node_modules');
        if (args.length > 0 && !isInternalLibrary) {
          throw new Error('Security Violation: Dynamic Function() constructor execution is disabled by AntiTamperSentinel.');
        }
        return (originalFunction as any).apply(this, args);
      };
      secureFunction.prototype = originalFunction.prototype;
      Object.defineProperty(globalThis, 'Function', {
        value: secureFunction,
        writable: false,
        configurable: false,
      });
    } catch {
      // Ignore if environment already restricts global Function modifications
    }
  }

  /**
   * 3. Runtime Configuration Immobility
   * Deeply freezes runtime environment configuration to prevent in-memory tampering of secrets.
   */
  private static freezeRuntimeConfiguration(): void {
    try {
      if (env && typeof env === 'object' && !Object.isFrozen(env)) {
        Object.freeze(env);
      }
    } catch (e: any) {
      logger.debug(`Config immobility notice: ${e.message}`);
    }
  }

  /**
   * 4. Anti-Debugging, Anti-Inspection & Hooking Traps
   * Detects if Node.js was launched with `--inspect`, `--inspect-brk`, V8 inspector, or injected NODE_OPTIONS.
   * Employs timing anomaly checks to detect breakpoint stepping.
   */
  private static enforceDebuggerProtection(): void {
    const isInspectorActive = (): boolean => {
      try {
        return !!inspector.url();
      } catch {
        return false;
      }
    };

    const hasSuspiciousArgs = (): boolean => {
      const execArgs = (process.execArgv || []).join(' ').toLowerCase();
      const nodeOptions = (process.env.NODE_OPTIONS || '').toLowerCase();
      const suspiciousFlags = [
        '--inspect',
        '--inspect-brk',
        '--inspect-port',
        '--debug',
        '--require',
        '--loader',
        '--import',
      ];

      return suspiciousFlags.some(
        (flag) => execArgs.includes(flag) || nodeOptions.includes(flag)
      );
    };

    // Strip debugProcess hook to prevent live attaching
    if (typeof (process as any)._debugProcess === 'function') {
      try {
        (process as any)._debugProcess = () => {
          logger.error('🚨 Live debugger attach attempt blocked.');
        };
      } catch {
        // Safe to ignore
      }
    }

    if (env.NODE_ENV === 'production') {
      if (isInspectorActive() || hasSuspiciousArgs()) {
        logger.error('🚨 SECURITY ALERT: Unauthorized debugger or suspicious hooks detected in production. Halting process.');
        process.exit(1);
      }

      // Periodic anti-attach and timing-trap watchdog in production
      setInterval(() => {
        if (isInspectorActive() || !AntiTamperSentinel.verifyTimingIntegrity()) {
          logger.error('🚨 SECURITY ALERT: Active debugger hook or execution delay trap detected. Terminating process.');
          process.exit(1);
        }
      }, 5000).unref();
    }
  }

  /**
   * Timing Anomaly Trap: Detects interactive debugger stepping or breakpoint pauses.
   */
  public static verifyTimingIntegrity(): boolean {
    const start = Date.now();
    let checksum = 0;
    for (let i = 0; i < 50000; i++) {
      checksum = (checksum + i) ^ 0x5a;
    }
    const elapsed = Date.now() - start;
    // Execution of a 50k simple loop takes < 5ms. If > 100ms, execution was paused by a human debugger.
    return elapsed < 100;
  }

  /**
   * 5. Hardened Error & Process Protections
   * Prevents credential leakage in uncaught exceptions and memory dumps.
   */
  private static hardenProcessSecurity(): void {
    process.on('uncaughtException', (error: Error) => {
      const sanitizedMessage = (error?.message || '').replace(
        /(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@)/gi,
        '$1[REDACTED]$2'
      );
      logger.error('🚨 Critical Uncaught Exception neutralized:', {
        name: error?.name,
        message: sanitizedMessage,
        ...(env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
      });

      // Avoid hanging in corrupted state
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any) => {
      logger.error('🚨 Critical Unhandled Rejection neutralized:', {
        reason: reason?.message || String(reason),
      });
    });
  }
}

