import { publicEnv } from "@/env.public"

export function renderForgotPasswordEmail(params: { token: string }): string {
  const resetLink = `${publicEnv.PUBLIC_BASE_URL}/reset-password?token=${params.token}`
  return `
  <html>
    <body style="margin:0;padding:0;background-color:#0f0f10;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;color:#e2e2e4;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 16px;">
            <table width="480" cellpadding="0" cellspacing="0" style="background-color:#1a1a1c;border-radius:8px;border:1px solid #2e2e32;overflow:hidden;">
              <tr>
                <td style="padding:32px 32px 0;text-align:left;">
                  <p style="margin:0;font-size:18px;font-weight:600;color:#e2e2e4;letter-spacing:-0.3px;">Linya</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px 32px;">
                  <p style="margin:0 0 16px;font-size:15px;color:#a1a1aa;">We received a request to reset your password.</p>
                  <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
                    <tr>
                      <td style="background-color:#5e6ad2;border-radius:6px;">
                        <a href="${resetLink}" style="display:inline-block;color:#ffffff;padding:10px 20px;font-size:14px;font-weight:500;text-decoration:none;">Reset password</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Or copy this link:</p>
                  <p style="margin:0;font-size:12px;color:#52525b;word-break:break-all;">${resetLink}</p>
                  <p style="margin:16px 0 0;font-size:13px;color:#71717a;">Expires in 15 minutes. If you didn't request this, ignore this email.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `
}
