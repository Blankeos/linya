export function renderOtpEmail(params: { email: string; otp: string }): string {
  const { email, otp } = params
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
                  <p style="margin:0 0 16px;font-size:15px;color:#a1a1aa;">Your one-time code for <strong style="color:#e2e2e4;">${email}</strong></p>
                  <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
                    <tr>
                      <td style="background-color:#27272a;border:1px solid #3f3f46;border-radius:6px;padding:14px 24px;font-size:32px;font-weight:700;letter-spacing:6px;color:#e2e2e4;">
                        ${otp}
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0;font-size:13px;color:#71717a;">Expires in 5 minutes. If you didn't request this, ignore this email.</p>
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
