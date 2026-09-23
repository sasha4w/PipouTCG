import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  // RESEND_API_KEY est optionnelle (env.validation) : sans clé (tests, dev
  // local), l'API démarre et les emails ne partent pas.
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  async sendResetPassword(email: string, token: string) {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY absente : email de réinitialisation non envoyé à ${email}`,
      );
      return;
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await this.resend.emails.send({
      from: 'TCG App <onboarding@resend.dev>', // ← remplace par ton domaine vérifié plus tard
      to: email,
      subject: '🔑 Réinitialisation de ton mot de passe',
      html: `
        <h2>Mot de passe oublié ?</h2>
        <p>Clique sur le lien ci-dessous pour réinitialiser ton mot de passe :</p>
        <a href="${resetUrl}" style="padding: 10px 20px; background: #6366f1; color: white; border-radius: 5px; text-decoration: none;">
          Réinitialiser mon mot de passe
        </a>
        <p>Ce lien expire dans <strong>15 minutes</strong>.</p>
        <p>Si tu n'as pas demandé ça, ignore cet email.</p>
      `,
    });
  }
}
