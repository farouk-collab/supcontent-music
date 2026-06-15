import nodemailer from "nodemailer";

function envBoolean(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export function isEmailConfigured() {
  return Boolean(
    String(process.env.SMTP_HOST || "").trim() &&
    String(process.env.SMTP_USER || "").trim() &&
    String(process.env.SMTP_PASS || "").trim() &&
    String(process.env.MAIL_FROM || "").trim()
  );
}

export async function sendPasswordResetEmail(input: {
  to: string;
  displayName?: string | null;
  resetUrl: string;
  expiresInMinutes?: number;
}) {
  if (!isEmailConfigured()) return { sent: false, reason: "not_configured" as const };

  const port = Number.parseInt(String(process.env.SMTP_PORT || "587"), 10);
  const transporter = nodemailer.createTransport({
    host: String(process.env.SMTP_HOST || "").trim(),
    port: Number.isFinite(port) ? port : 587,
    secure: envBoolean(process.env.SMTP_SECURE),
    auth: {
      user: String(process.env.SMTP_USER || "").trim(),
      pass: String(process.env.SMTP_PASS || ""),
    },
  });

  const expiresInMinutes = input.expiresInMinutes || 15;
  const name = String(input.displayName || "utilisateur").trim();
  const subject = "Réinitialisation de votre mot de passe SUPCONTENT Music";
  const text = [
    `Bonjour ${name},`,
    "",
    "Une réinitialisation de mot de passe a été demandée pour votre compte.",
    `Ouvrez ce lien dans les ${expiresInMinutes} minutes :`,
    input.resetUrl,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  ].join("\n");

  await transporter.sendMail({
    from: String(process.env.MAIL_FROM || "").trim(),
    to: input.to,
    subject,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">
        <h1 style="font-size:22px">Réinitialisation du mot de passe</h1>
        <p>Bonjour ${escapeHtml(name)},</p>
        <p>Une réinitialisation a été demandée pour votre compte SUPCONTENT Music.</p>
        <p><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;padding:12px 18px;background:#10b981;color:#04130d;text-decoration:none;font-weight:700">Choisir un nouveau mot de passe</a></p>
        <p>Ce lien expire dans ${expiresInMinutes} minutes.</p>
        <p style="color:#6b7280">Ignorez cet e-mail si vous n'êtes pas à l'origine de la demande.</p>
      </div>
    `,
  });

  return { sent: true as const };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
