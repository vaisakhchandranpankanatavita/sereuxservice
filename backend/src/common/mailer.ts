import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

/* Optional outbound email. Without SMTP_HOST/SMTP_USER/SMTP_PASS configured, every "send" just logs
   the content — fine for local dev and for a reset link you can read off the server console — and
   never blocks or throws, so nothing that calls this needs to branch on whether email is set up. */
@Injectable()
export class MailerService {
  private readonly log = new Logger('Mailer');
  private transporter: Transporter | null = null;

  private get() {
    if (this.transporter) return this.transporter;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
    this.transporter = createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT) || 587, secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    return this.transporter;
  }

  async send(to: string, subject: string, text: string) {
    const transporter = this.get();
    if (!transporter) {
      this.log.log(`[dev: no SMTP configured] To: ${to} | Subject: ${subject}\n${text}`);
      return;
    }
    try {
      await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
    } catch (e) {
      this.log.error(`sendMail failed for ${to}: ${e}`);
    }
  }
}

@Global()
@Module({ providers: [MailerService], exports: [MailerService] })
export class MailerModule {}
