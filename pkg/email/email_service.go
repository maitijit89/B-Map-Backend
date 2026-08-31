package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"strings"

	"github.com/maitijit89/b-map-backend/config"
)

type Service interface {
	SendOTPEmail(toEmail, otpCode string) error
}

type smtpEmailService struct {
	cfg *config.SMTPConfig
}

func NewSMTPService(cfg *config.SMTPConfig) Service {
	return &smtpEmailService{cfg: cfg}
}

// SendOTPEmail dispatches a branded HTML email containing the 6-digit OTP.
func (s *smtpEmailService) SendOTPEmail(toEmail, otpCode string) error {
	if s.cfg.Username == "" || s.cfg.Password == "" {
		log.Printf("[Email] SMTP credentials not set, simulating OTP dispatch to %s: %s", toEmail, otpCode)
		return nil
	}

	from := s.cfg.FromEmail
	if from == "" {
		from = s.cfg.Username
	}

	subject := fmt.Sprintf("%s - Your Verification Code is %s", s.cfg.FromName, otpCode)

	body := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
        .container { max-width: 580px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #1a73e8 0%%, #0d47a1 100%%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; }
        .content { padding: 32px 28px; color: #334155; }
        .greeting { font-size: 16px; margin-bottom: 20px; }
        .otp-box { background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 34px; font-weight: 800; color: #1a73e8; letter-spacing: 8px; margin: 0; font-family: monospace; }
        .expiry-text { font-size: 13px; color: #64748b; margin-top: 8px; }
        .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>B-Map Navigation</h1>
        </div>
        <div class="content">
            <p class="greeting">Hello,</p>
            <p>You requested a one-time verification code to log in to your <strong>B-Map</strong> account.</p>
            <div class="otp-box">
                <div class="otp-code">%s</div>
                <div class="expiry-text">Valid for the next 5 minutes</div>
            </div>
            <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
                If you did not request this verification code, please ignore this email. Do not share this code with anyone.
            </p>
        </div>
        <div class="footer">
            &copy; 2026 B-Map Platform. All rights reserved.
        </div>
    </div>
</body>
</html>`, otpCode)

	msg := fmt.Sprintf("From: %s <%s>\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n\r\n"+
		"%s", s.cfg.FromName, from, toEmail, subject, body)

	// Clean password in case user provided spaced string like "zrlq mahe eyeq lkhh"
	cleanedPassword := strings.ReplaceAll(s.cfg.Password, " ", "")

	auth := smtp.PlainAuth("", s.cfg.Username, cleanedPassword, s.cfg.Host)
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)

	// Send through STARTTLS on port 587
	err := sendMailWithSTARTTLS(addr, auth, from, []string{toEmail}, []byte(msg), s.cfg.Host)
	if err != nil {
		log.Printf("[Email] Failed to send email via SMTP: %v", err)
		return err
	}

	log.Printf("[Email] Successfully delivered OTP email to %s", toEmail)
	return nil
}

func sendMailWithSTARTTLS(addr string, auth smtp.Auth, from string, to []string, msg []byte, host string) error {
	client, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("smtp dial failed: %w", err)
	}
	defer client.Close()

	tlsConfig := &tls.Config{
		ServerName: host,
	}

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err = client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("starttls failed: %w", err)
		}
	}

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err = client.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth failed: %w", err)
			}
		}
	}

	if err = client.Mail(from); err != nil {
		return fmt.Errorf("mail from failed: %w", err)
	}

	for _, recipient := range to {
		if err = client.Rcpt(recipient); err != nil {
			return fmt.Errorf("rcpt failed: %w", err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("data command failed: %w", err)
	}

	_, err = w.Write(msg)
	if err != nil {
		return fmt.Errorf("writing message failed: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("closing data failed: %w", err)
	}

	return client.Quit()
}
