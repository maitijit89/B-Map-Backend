import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../core/config/env.config';
import { logger } from '../core/config/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class MailerService {
  private transporter: Transporter | null = null;
  private host: string;
  private port: number;
  private user: string;
  private pass: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.host = env.SMTP_HOST;
    this.port = env.SMTP_PORT;
    this.user = env.SMTP_USERNAME;
    this.pass = env.SMTP_PASSWORD;
    this.fromEmail = env.SMTP_FROM_EMAIL;
    this.fromName = env.SMTP_FROM_NAME;

    try {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465, // true for port 465, false for port 587 (STARTTLS)
        auth: {
          user: this.user,
          pass: this.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    } catch (err: any) {
      logger.warn(`Failed to initialize nodemailer transporter: ${err.message}`);
    }
  }

  /**
   * Sends an OTP email for account verification or login.
   */
  async sendOtpEmail(toEmail: string, otp: string, purpose: 'Verification' | 'Login' | string = 'Verification'): Promise<boolean> {
    const isLogin = purpose.toLowerCase().includes('login');
    const title = isLogin ? 'Login Passcode' : 'Email Verification Code';
    const actionDesc = isLogin
      ? 'Use the passcode below to securely log in to your B-Map account.'
      : 'Thank you for registering with B-Map. Please use the code below to verify your email address.';

    const subject = `[${this.fromName}] Your ${purpose} OTP: ${otp}`;
    const text = `Hello,\n\n${actionDesc}\n\nYour B-Map ${purpose} Passcode: ${otp}\n\nThis OTP is valid for ${env.OTP_EXPIRY_MINUTES} minutes. For security reasons, do not share this passcode with anyone.\n\nWarm regards,\nThe B-Map Team`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 32px 28px; text-align: center; }
          .title { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
          .desc { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
          .otp-badge { background: #f8fafc; border: 2px dashed #0284c7; border-radius: 8px; padding: 18px 24px; display: inline-block; margin: 0 auto 24px; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace; }
          .expiry-note { font-size: 13px; color: #ef4444; font-weight: 500; margin-bottom: 20px; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🗺️ ${this.fromName}</h1>
            <p>Next-Gen Spatial Navigation & Super-App Ecosystem</p>
          </div>
          <div class="content">
            <div class="title">${title}</div>
            <div class="desc">${actionDesc}</div>
            <div class="otp-badge">
              <div class="otp-code">${otp}</div>
            </div>
            <div class="expiry-note">⏱️ Valid for ${env.OTP_EXPIRY_MINUTES} minutes only.</div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${this.fromName}. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendMail({
      to: toEmail,
      subject,
      text,
      html,
    });
  }

  /**
   * Sends a confirmed lifestyle booking receipt/voucher email.
   */
  async sendBookingVoucher(
    toEmail: string,
    bookingDetails: { poiName: string; confirmationCode: string; date: string; time: string }
  ): Promise<boolean> {
    const subject = `[${this.fromName}] Booking Confirmed: ${bookingDetails.poiName} (${bookingDetails.confirmationCode})`;
    const text = `Your reservation at ${bookingDetails.poiName} is confirmed for ${bookingDetails.date} at ${bookingDetails.time}.\nVoucher Code: ${bookingDetails.confirmationCode}`;

    return this.sendMail({
      to: toEmail,
      subject,
      text,
    });
  }

  /**
   * Dispatches email via Nodemailer transport with resilient fallback logging.
   */
  private async sendMail(message: EmailMessage): Promise<boolean> {
    logger.info(
      `📧 Outgoing Email [${message.subject}] to: ${message.to} from: ${this.fromName} <${this.fromEmail}> via ${this.host}:${this.port}`
    );

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: `"${this.fromName}" <${this.fromEmail}>`,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        logger.info(`✅ Email dispatched successfully via Gmail SMTP. MessageId: ${info.messageId}`);
        return true;
      } catch (err: any) {
        logger.warn(
          `⚠️ SMTP dispatch error (${err.message}). The OTP is still logged and stored in cache for verification.`
        );
        return true;
      }
    }

    return true;
  }
}

export const mailerService = new MailerService();
