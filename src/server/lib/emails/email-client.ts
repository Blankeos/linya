// ===========================================================================
// sendEmail must always follow this type.
// ===========================================================================

export type SendEmailFunction = (params: {
  from?: { address: string; name?: string }
  to: string
  subject: string
  html: string
}) => Promise<void>

// ===========================================================================
// Implementation — swap this file's export to change provider.
// Priority: SMTP if configured, else ZeptoMail, else console.log (dev).
// ===========================================================================

import { privateEnv } from "@/env.private"

export const sendEmail: SendEmailFunction = async (params) => {
  // Dev fallback: just log
  if (privateEnv.NODE_ENV === "development" && !privateEnv.SMTP_HOST && !privateEnv.ZEPTOMAIL_TOKEN) {
    console.log("[sendEmail] DEV — would send email:", {
      to: params.to,
      subject: params.subject,
    })
    return
  }

  // SMTP path
  if (privateEnv.SMTP_HOST) {
    const { default: nodemailer } = await import("nodemailer")
    const transporter = nodemailer.createTransport({
      host: privateEnv.SMTP_HOST,
      port: privateEnv.SMTP_PORT ?? 465,
      secure: privateEnv.SMTP_SECURE ?? true,
      auth: { user: privateEnv.SMTP_USER, pass: privateEnv.SMTP_PASS },
    })
    const from = privateEnv.SMTP_FROM ?? "Linya <noreply@linya.app>"
    await transporter.sendMail({ from, to: params.to, subject: params.subject, html: params.html })
    return
  }

  // ZeptoMail path
  if (privateEnv.ZEPTOMAIL_TOKEN) {
    const { SendMailClient } = await import("zeptomail")
    const raw = privateEnv.ZEPTOMAIL_FROM!
    const match = raw.match(/^(.+?)\s*<([^>]+)>$/)!
    const FROM = { name: match[1].trim(), address: match[2].trim() }
    const client = new SendMailClient({ url: "api.zeptomail.com/", token: privateEnv.ZEPTOMAIL_TOKEN })
    await client.sendMail({
      from: { ...FROM, ...params.from },
      to: [{ email_address: { address: params.to } }] as any,
      subject: params.subject,
      htmlbody: params.html,
    })
    return
  }

  console.warn("[sendEmail] No email provider configured. Email not sent.")
}
