import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendResetPassword(email: string, token: string) {
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
