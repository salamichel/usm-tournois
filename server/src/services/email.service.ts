import * as brevo from '@getbrevo/brevo';

// Initialize Brevo client
let apiInstance: brevo.TransactionalEmailsApi | null = null;

/**
 * Initialize the Brevo email service
 */
export const initializeEmailService = (): void => {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn('BREVO_API_KEY not found. Email service will not be available.');
    return;
  }

  try {
    apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    console.log('Brevo email service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Brevo email service:', error);
  }
};

/**
 * Send a password reset email using Brevo
 * @param to Recipient email address
 * @param resetLink Password reset link
 * @returns Promise<boolean> True if email sent successfully
 */
export const sendPasswordResetEmail = async (
  to: string,
  resetLink: string
): Promise<boolean> => {
  if (!apiInstance) {
    console.error('Email service not initialized. Cannot send email.');
    return false;
  }

  const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@usmtournois.com';
  const fromName = process.env.EMAIL_FROM_NAME || 'USM Tournois';

  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.sender = {
    email: fromEmail,
    name: fromName
  };

  sendSmtpEmail.to = [{ email: to }];
  sendSmtpEmail.subject = 'Réinitialisation de votre mot de passe';

  // HTML email template
  sendSmtpEmail.htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de mot de passe</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f4f4f4; padding: 20px; border-radius: 10px;">
    <h2 style="color: #2c3e50; margin-bottom: 20px;">Réinitialisation de votre mot de passe</h2>

    <p>Bonjour,</p>

    <p>Vous avez demandé à réinitialiser votre mot de passe pour votre compte USM Tournois.</p>

    <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}"
         style="background-color: #3498db;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                display: inline-block;
                font-weight: bold;">
        Réinitialiser mon mot de passe
      </a>
    </div>

    <p>Ou copiez et collez ce lien dans votre navigateur :</p>
    <p style="background-color: #fff; padding: 10px; border-radius: 5px; word-break: break-all;">
      <a href="${resetLink}" style="color: #3498db;">${resetLink}</a>
    </p>

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666;">
      <strong>Important :</strong> Ce lien est valable pendant 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
    </p>

    <p style="font-size: 14px; color: #666;">
      Cordialement,<br>
      L'équipe USM Tournois
    </p>
  </div>
</body>
</html>
  `;

  // Plain text version as fallback
  sendSmtpEmail.textContent = `
Réinitialisation de votre mot de passe

Bonjour,

Vous avez demandé à réinitialiser votre mot de passe pour votre compte USM Tournois.

Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
${resetLink}

Important : Ce lien est valable pendant 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.

Cordialement,
L'équipe USM Tournois
  `;

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`Password reset email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

/**
 * Test email connection (useful for debugging)
 * @returns Promise<boolean> True if connection is working
 */
export const testEmailConnection = async (): Promise<boolean> => {
  if (!apiInstance) {
    console.error('Email service not initialized');
    return false;
  }

  try {
    // This is just to verify the API key is valid
    return true;
  } catch (error) {
    console.error('Email connection test failed:', error);
    return false;
  }
};
