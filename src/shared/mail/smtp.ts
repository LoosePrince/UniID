import nodemailer from "nodemailer";
import { ApiError } from "@/shared/errors";
import { getSystemConfig } from "@/shared/system-config";

export type MailSendSkipReason = "disabled" | "incomplete";

export interface MailSendResult {
  sent: boolean;
  reason?: MailSendSkipReason;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(input: SendMailInput): Promise<MailSendResult> {
  const config = await getSystemConfig();
  if (!config.smtpEnabled) return { sent: false, reason: "disabled" };
  if (!config.smtpHost || !config.smtpPort || !config.smtpFrom) {
    return { sent: false, reason: "incomplete" };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser
      ? {
          user: config.smtpUser,
          pass: config.smtpPassword
        }
      : undefined
  });

  try {
    await transporter.sendMail({
      from: config.smtpFrom,
      to: input.to,
      replyTo: config.smtpReplyTo || undefined,
      subject: input.subject,
      text: input.text,
      html: input.html
    });
    return { sent: true };
  } catch {
    throw new ApiError("MAIL_SEND_FAILED");
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
