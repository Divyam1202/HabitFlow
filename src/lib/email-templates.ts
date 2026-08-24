const APP_URL = 'https://habyt-flow.vercel.app'
const HABITS_URL = `${APP_URL}/habits`

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

const wordmark = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 220" width="250" height="auto" shape-rendering="geometricPrecision" style="display:block;max-width:100%;">
  <defs><style>.hf-text{font-family:Montserrat,Arial,sans-serif;font-weight:900;letter-spacing:-3px}.hf-shape{fill:#F4F4F0;stroke:#000;stroke-width:4;stroke-linejoin:round;stroke-linecap:round}</style></defs>
  <g transform="skewX(-15) translate(80,25)">
    <g><path class="hf-shape" d="M0 0h40v76H0z"/><g class="hf-shape"><rect x="0" y="80" width="18" height="18"/><rect x="22" y="80" width="18" height="18"/><rect x="0" y="102" width="18" height="18"/><rect x="22" y="102" width="18" height="18"/><rect x="0" y="124" width="18" height="18"/><rect x="22" y="124" width="18" height="18"/><rect x="0" y="146" width="18" height="18"/><rect x="22" y="146" width="18" height="18"/></g><path class="hf-shape" d="M40 70h45v26H40z"/><path class="hf-shape" d="M85 0h40v164H85z"/><g stroke="#000" stroke-width="3" stroke-linejoin="round"><rect x="85" y="60" width="20" height="20" fill="#86EFAC"/><rect x="85" y="80" width="20" height="20" fill="#22C55E"/><rect x="85" y="100" width="20" height="20" fill="#064E3B"/><path fill="#9CA3AF" d="M105 60h5a10 10 0 0 1 0 20h-5z"/></g></g>
    <text x="142" y="164" font-size="175" fill="#F4F4F0" class="hf-text">abyt</text>
    <g transform="translate(560,0)"><path class="hf-shape" d="M0 0h40v76H0z"/><g class="hf-shape"><rect x="0" y="80" width="18" height="18"/><rect x="22" y="80" width="18" height="18"/><rect x="0" y="102" width="18" height="18"/><rect x="22" y="102" width="18" height="18"/><rect x="0" y="124" width="18" height="18"/><rect x="22" y="124" width="18" height="18"/><rect x="0" y="146" width="18" height="18"/><rect x="22" y="146" width="18" height="18"/></g><path class="hf-shape" d="M40 0h90c30 0 50 5 70-15-25 50-60 55-90 55H40z"/><path stroke="#000" stroke-width="4" d="M80 0v40M120 0v40"/><path class="hf-shape" d="M40 70h50c25 0 45 5 55 10-20 30-50 35-75 35H40z"/><path stroke="#000" stroke-width="4" d="M80 70v45"/></g>
    <text x="755" y="164" font-size="175" fill="#F4F4F0" class="hf-text">low</text>
  </g>
</svg>`

function shell(title: string, content: string, maxWidth = 520): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F4F4F0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0A0A;padding:40px 15px"><tr><td align="center"><table role="presentation" width="100%" style="max-width:${maxWidth}px;background:#141414;border:1px solid #262626;border-radius:16px;padding:36px 32px;box-shadow:0 8px 32px rgba(0,0,0,.5)"><tr><td align="center" style="padding-bottom:24px">${wordmark}</td></tr>${content}</table></td></tr></table></body></html>`
}

function footer(label: string): string {
  return `<tr><td style="border-top:1px solid #262626;padding-top:20px;text-align:center;color:#525252;font-size:11px">© ${new Date().getFullYear()} HabytFlow • ${escapeHtml(label)}</td></tr>`
}

export function welcomeEmailHtml(username: string): string {
  return shell('Welcome to HabytFlow', `<tr><td align="center" style="padding-bottom:24px"><div style="background:linear-gradient(135deg,#064E3B,#22C55E);width:64px;height:64px;border-radius:16px;line-height:64px;font-size:32px">🚀</div></td></tr><tr><td style="padding-bottom:16px;text-align:center"><h1 style="margin:0;font-size:22px;color:#F4F4F0">You're in. Welcome to the flow.</h1></td></tr><tr><td style="padding-bottom:32px;text-align:center;color:#9CA3AF;font-size:15px;line-height:24px">Hi <strong>${escapeHtml(username)}</strong>,<br><br>Thank you for choosing HabytFlow. You've just taken the first step towards building unbreakable routines. We're here to keep your momentum alive.</td></tr><tr><td align="center" style="padding-bottom:32px"><a href="${HABITS_URL}" target="_blank" style="display:inline-block;background:#22C55E;color:#000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px">Create Your First Habit</a></td></tr>${footer('Keep your momentum going.')}`)
}

export function verificationOtpEmailHtml(otp: string): string {
  return shell('Verify your HabytFlow account', `<tr><td style="padding-bottom:8px"><h1 style="margin:0;font-size:20px;text-align:center;color:#F4F4F0">Verification Code</h1></td></tr><tr><td style="padding-bottom:28px;text-align:center;color:#9CA3AF;font-size:14px;line-height:22px">Use the single-use code below to complete your sign-in or account setup.</td></tr><tr><td align="center" style="padding-bottom:24px"><div style="display:inline-block;background:#1F1F1F;border:1px solid #333;border-radius:12px;padding:18px 36px"><span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:#22C55E">${escapeHtml(otp)}</span></div></td></tr><tr><td style="padding-bottom:28px;text-align:center;color:#737373;font-size:12px">⏱️ This code will expire in <strong>10 minutes</strong>. If you didn't request this, please ignore this email.</td></tr>${footer('Keep your momentum going.')}`, 480)
}

export function passwordResetEmailHtml(username: string, resetUrl: string): string {
  return shell('Reset your HabytFlow password', `<tr><td style="padding-bottom:8px"><h1 style="margin:0;font-size:20px;text-align:center;color:#F4F4F0">Reset Your Password</h1></td></tr><tr><td style="padding-bottom:28px;text-align:center;color:#9CA3AF;font-size:14px;line-height:22px">Hello <strong style="color:#F4F4F0">${escapeHtml(username)}</strong>,<br>We received a request to reset your password. Click below to choose a new one.</td></tr><tr><td align="center" style="padding-bottom:28px"><a href="${escapeAttribute(resetUrl)}" target="_blank" style="display:inline-block;background:#22C55E;color:#000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px">Reset Password</a></td></tr><tr><td style="background:#1A1A1A;border-radius:8px;padding:12px 16px;color:#A3A3A3;font-size:12px;line-height:18px;text-align:center">🔒 This link expires in <strong>5 minutes</strong>.<br>If you did not make this request, you can safely ignore this email.</td></tr>${footer('Account Security')}`, 480)
}

export function maintenanceEmailHtml(username: string, date: string, startTime: string, endTime: string): string {
  return shell('HabytFlow Maintenance Notice', `<tr><td align="center" style="padding-bottom:16px"><span style="display:inline-block;background:#3F3F46;color:#F4F4F0;font-size:11px;font-weight:700;padding:6px 12px;border-radius:20px;text-transform:uppercase">⚙️ System Notice</span></td></tr><tr><td style="padding-bottom:16px;text-align:center"><h1 style="margin:0;font-size:20px;color:#F4F4F0">Scheduled Maintenance</h1></td></tr><tr><td style="padding-bottom:24px;text-align:center;color:#9CA3AF;font-size:14px;line-height:22px">Hi <strong>${escapeHtml(username)}</strong>,<br><br>We are upgrading our servers to make HabytFlow faster and more reliable. The app will be temporarily unavailable during this window:</td></tr><tr><td align="center" style="padding-bottom:24px"><div style="background:#1F1F1F;border:1px solid #333;border-radius:8px;padding:16px;width:80%;text-align:center"><strong style="color:#F4F4F0;font-size:15px">${escapeHtml(date)}</strong><br><span style="color:#22C55E;font-weight:600;font-size:14px">${escapeHtml(startTime)} - ${escapeHtml(endTime)}</span></div></td></tr><tr><td style="padding-bottom:24px;text-align:center;color:#9CA3AF;font-size:13px;line-height:20px">Your habit data is completely safe. We apologize for the interruption and appreciate your patience.</td></tr>${footer('System Operations')}`, 500)
}

export function supportAlertEmailHtml(type: 'issue' | 'feature_request', email: string, message: string): string {
  const feature = type === 'feature_request'
  const label = feature ? '💡 Feature Request' : '🚨 Bug Report'
  const accent = feature ? '#3B82F6' : '#EF4444'
  return shell(feature ? 'New Feature Request' : 'New Bug Report', `<tr><td align="center" style="padding-bottom:16px"><span style="display:inline-block;background:${feature ? '#172554' : '#450A0A'};border:1px solid ${feature ? '#1E3A8A' : '#7F1D1D'};color:${feature ? '#BFDBFE' : '#FCA5A5'};font-size:11px;font-weight:700;padding:6px 12px;border-radius:20px;text-transform:uppercase">${label}</span></td></tr><tr><td style="padding-bottom:24px;text-align:center;border-bottom:1px solid #262626"><h1 style="margin:0;font-size:20px;color:#F4F4F0">New Support Ticket</h1></td></tr><tr><td style="padding:24px 0 16px;font-size:14px;line-height:22px;color:#F4F4F0"><strong style="color:#9CA3AF">Submitted By:</strong> <a href="mailto:${escapeAttribute(email)}" style="color:#60A5FA;text-decoration:none">${escapeHtml(email)}</a><br><strong style="color:#9CA3AF">Category:</strong> ${feature ? 'Feature Request' : 'Issue'}</td></tr><tr><td style="padding-bottom:32px"><div style="background:#1A1A1A;border:1px solid #333;border-left:4px solid ${accent};border-radius:8px;padding:20px;font-size:14px;line-height:24px;color:#D4D4D4;white-space:pre-line">${escapeHtml(message)}</div></td></tr><tr><td align="center" style="padding-bottom:24px"><a href="mailto:${escapeAttribute(email)}?subject=Re%3A%20Your%20HabytFlow%20Support%20Request" style="display:inline-block;background:#22C55E;color:#000;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px">Reply Directly to User</a></td></tr>${footer('Automated Support Telemetry')}`, 560)
}

export const emailLinks = { app: APP_URL, habits: HABITS_URL }