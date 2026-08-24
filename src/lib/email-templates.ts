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

const wordmark = '<img src="https://habyt-flow.vercel.app/habytflow-wordmark.svg" width="250" alt="HabytFlow" style="display:block;width:250px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />'

const legacyInlineWordmark = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1300 220" width="250" height="auto" shape-rendering="geometricPrecision" style="display:block;max-width:100%;">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&amp;display=swap');
      .hf-text { font-family: 'Montserrat', sans-serif; font-weight: 900; letter-spacing: -3px; }
      .hf-shape { fill: #F4F4F0; stroke: #000000; stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; }
    </style>
  </defs>
  <g transform="skewX(-15) translate(80, 25)">
    <g>
      <path class="hf-shape" d="M 0 0 h 40 v 76 h -40 z" />
      <g class="hf-shape">
        <rect x="0" y="80" width="18" height="18" />
        <rect x="22" y="80" width="18" height="18" />
        <rect x="0" y="102" width="18" height="18" />
        <rect x="22" y="102" width="18" height="18" />
        <rect x="0" y="124" width="18" height="18" />
        <rect x="22" y="124" width="18" height="18" />
        <rect x="0" y="146" width="18" height="18" />
        <rect x="22" y="146" width="18" height="18" />
      </g>
      <path class="hf-shape" d="M 40 70 h 45 v 26 h -45 z" />
      <path class="hf-shape" d="M 85 0 h 40 v 164 h -40 z" />
      <g stroke="#000000" stroke-width="3" stroke-linejoin="round">
        <rect x="85" y="60" width="20" height="20" fill="#86EFAC" />
        <rect x="85" y="80" width="20" height="20" fill="#22C55E" />
        <rect x="85" y="100" width="20" height="20" fill="#064E3B" />
        <path fill="#9CA3AF" d="M 105 60 h 5 a 10 10 0 0 1 0 20 h -5 z" />
      </g>
    </g>
    <text x="142" y="164" font-size="175" fill="#F4F4F0" class="hf-text">abyt</text>
    <g transform="translate(560, 0)">
      <path class="hf-shape" d="M 0 0 h 40 v 76 h -40 z" />
      <g class="hf-shape">
        <rect x="0" y="80" width="18" height="18" />
        <rect x="22" y="80" width="18" height="18" />
        <rect x="0" y="102" width="18" height="18" />
        <rect x="22" y="102" width="18" height="18" />
        <rect x="0" y="124" width="18" height="18" />
        <rect x="22" y="124" width="18" height="18" />
        <rect x="0" y="146" width="18" height="18" />
        <rect x="22" y="146" width="18" height="18" />
      </g>
      <path class="hf-shape" d="M 40 0 L 130 0 C 160 0, 180 5, 200 -15 C 175 35, 140 40, 110 40 L 40 40 Z" />
      <path stroke="#000000" stroke-width="4" d="M 80 0 v 40 M 120 0 v 40" />
      <path class="hf-shape" d="M 40 70 L 90 70 C 115 70, 135 75, 145 80 C 125 110, 95 115, 70 115 L 40 115 Z" />
      <path stroke="#000000" stroke-width="4" d="M 80 70 v 45" />
    </g>
    <text x="755" y="164" font-size="175" fill="#F4F4F0" class="hf-text">low</text>
  </g>
</svg>`

void legacyInlineWordmark

function shell(title: string, content: string, maxWidth = 520, padding = '36px 32px'): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:0;background-color:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F4F4F0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0A0A0A;padding:40px 15px"><tr><td align="center"><table role="presentation" width="100%" style="max-width:${maxWidth}px;background-color:#141414;border:1px solid #262626;border-radius:16px;padding:${padding};box-shadow:0 8px 32px rgba(0,0,0,0.5)"><tr><td align="center" style="padding-bottom:24px">${wordmark}</td></tr>${content}</table></td></tr></table></body></html>`
}

function footer(label: string): string {
  return `<tr><td style="border-top:1px solid #262626;padding-top:20px;text-align:center;color:#525252;font-size:11px">© ${new Date().getFullYear()} HabytFlow • ${escapeHtml(label)}</td></tr>`
}

export function welcomeEmailHtml(username: string): string {
  return shell('Welcome to HabytFlow', `<tr><td align="center" style="padding-bottom:24px"><div style="background:linear-gradient(135deg,#064E3B 0%,#22C55E 100%);width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:32px">🚀</div></td></tr><tr><td style="padding-bottom:16px;text-align:center"><h1 style="margin:0;font-size:22px;font-weight:800;color:#F4F4F0">You're in. Welcome to the flow.</h1></td></tr><tr><td style="padding-bottom:32px;text-align:center;color:#9CA3AF;font-size:15px;line-height:24px">Hi <strong>${escapeHtml(username)}</strong>,<br><br>Thank you for choosing HabytFlow. You've just taken the first step towards building unbreakable routines. Whether you're tracking daily gym sessions or deep work blocks, we're here to keep your momentum alive.</td></tr><tr><td align="center" style="padding-bottom:32px"><a href="${HABITS_URL}" target="_blank" style="display:inline-block;background-color:#22C55E;color:#000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(34,197,94,0.3)">Create Your First Habit</a></td></tr><tr><td style="border-top:1px solid #262626;padding-top:24px;text-align:center;color:#525252;font-size:12px;line-height:18px">Let's build something great today.<br>© ${new Date().getFullYear()} HabytFlow HQ</td></tr>`, 520, '40px 32px')
}

export function verificationOtpEmailHtml(otp: string): string {
  return shell('Verify your HabytFlow account', `<tr><td style="padding-bottom:8px"><h1 style="margin:0;font-size:20px;font-weight:700;color:#F4F4F0;text-align:center">Verification Code</h1></td></tr><tr><td style="padding-bottom:28px;text-align:center;color:#9CA3AF;font-size:14px;line-height:22px">Use the single-use code below to complete your sign-in or account setup.</td></tr><tr><td align="center" style="padding-bottom:24px"><div style="display:inline-block;background-color:#1F1F1F;border:1px solid #333333;border-radius:12px;padding:18px 36px;text-align:center"><span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:800;letter-spacing:8px;color:#22C55E;margin-left:8px">${escapeHtml(otp)}</span></div></td></tr><tr><td style="padding-bottom:28px;text-align:center;color:#737373;font-size:12px">⏱️ This code will expire in <strong>10 minutes</strong>. If you didn't request this, please ignore this email.</td></tr>${footer('Keep your momentum going.')}`, 480)
}

export function passwordResetEmailHtml(username: string, resetUrl: string): string {
  return shell('Reset your HabytFlow password', `<tr><td style="padding-bottom:8px"><h1 style="margin:0;font-size:20px;font-weight:700;color:#F4F4F0;text-align:center">Reset Your Password</h1></td></tr><tr><td style="padding-bottom:28px;text-align:center;color:#9CA3AF;font-size:14px;line-height:22px">Hello <strong style="color:#F4F4F0">${escapeHtml(username)}</strong>,<br>We received a request to reset your password. Click the button below to choose a new one.</td></tr><tr><td align="center" style="padding-bottom:28px"><a href="${escapeAttribute(resetUrl)}" target="_blank" style="display:inline-block;background-color:#22C55E;color:#000000;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;text-align:center;box-shadow:0 4px 14px rgba(34,197,94,0.3)">Reset Password</a></td></tr><tr><td style="background-color:#1A1A1A;border-radius:8px;padding:12px 16px;margin-bottom:24px;color:#A3A3A3;font-size:12px;line-height:18px;text-align:center">🔒 This link expires in <strong>5 minutes</strong>.<br>If you did not make this request, you can safely ignore this email.</td></tr>${footer('Account Security')}`, 480)
}

export function maintenanceEmailHtml(username: string, date: string, startTime: string, endTime: string): string {
  return shell('HabytFlow Maintenance Notice', `<tr><td align="center" style="padding-bottom:16px"><span style="display:inline-block;background-color:#3F3F46;color:#F4F4F0;font-size:11px;font-weight:700;padding:6px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px">⚙️ System Notice</span></td></tr><tr><td style="padding-bottom:16px;text-align:center"><h1 style="margin:0;font-size:20px;font-weight:700;color:#F4F4F0">Scheduled Maintenance</h1></td></tr><tr><td style="padding-bottom:24px;text-align:center;color:#9CA3AF;font-size:14px;line-height:22px">Hi <strong>${escapeHtml(username)}</strong>,<br><br>We are upgrading our servers to make HabytFlow faster and more reliable. The app will be temporarily unavailable during the following window:</td></tr><tr><td align="center" style="padding-bottom:24px"><div style="background-color:#1F1F1F;border:1px solid #333333;border-radius:8px;padding:16px;width:80%;text-align:center"><strong style="color:#F4F4F0;font-size:15px">${escapeHtml(date)}</strong><br><span style="color:#22C55E;font-weight:600;font-size:14px">${escapeHtml(startTime)} - ${escapeHtml(endTime)}</span></div></td></tr><tr><td style="padding-bottom:24px;text-align:center;color:#9CA3AF;font-size:13px;line-height:20px">Your habit data is completely safe. We apologize for the interruption and appreciate your patience as we improve your experience.</td></tr>${footer('System Operations')}`, 500)
}

export function supportAlertEmailHtml(type: 'issue' | 'feature_request', email: string, message: string): string {
  const feature = type === 'feature_request'
  const label = feature ? '💡 Feature Request' : '🚨 Bug Report'
  const accent = feature ? '#3B82F6' : '#EF4444'
  const replySubject = feature ? 'Re%3A%20Your%20HabytFlow%20Feature%20Request' : 'Re%3A%20Your%20HabytFlow%20Support%20Request'
  return shell(feature ? 'New Feature Request' : 'New Bug Report', `<tr><td align="center" style="padding-bottom:16px"><span style="display:inline-block;background:${feature ? '#172554' : '#450A0A'};border:1px solid ${feature ? '#1E3A8A' : '#7F1D1D'};color:${feature ? '#BFDBFE' : '#FCA5A5'};font-size:11px;font-weight:700;padding:6px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px">${label}</span></td></tr><tr><td style="padding-bottom:24px;text-align:center;border-bottom:1px solid #262626"><h1 style="margin:0;font-size:20px;font-weight:700;color:#F4F4F0">New Support Ticket</h1></td></tr><tr><td style="padding:24px 0 16px"><table width="100%" role="presentation" style="font-size:14px;line-height:22px"><tr><td width="30%" style="color:#9CA3AF;font-weight:600">Submitted By:</td><td width="70%" style="color:#F4F4F0;font-weight:600"><a href="mailto:${escapeAttribute(email)}" style="color:#60A5FA;text-decoration:none">${escapeHtml(email)}</a></td></tr><tr><td style="color:#9CA3AF;font-weight:600;padding-top:8px">Category:</td><td style="color:#F4F4F0;padding-top:8px;text-transform:capitalize">${feature ? 'Feature Request' : 'Issue'}</td></tr></table></td></tr><tr><td style="padding-bottom:32px"><div style="background-color:#1A1A1A;border:1px solid #333333;border-left:4px solid ${accent};border-radius:8px;padding:20px;font-size:14px;line-height:24px;color:#D4D4D4;white-space:pre-line">${escapeHtml(message)}</div></td></tr><tr><td align="center" style="padding-bottom:24px"><a href="mailto:${escapeAttribute(email)}?subject=${replySubject}" style="display:inline-block;background-color:#22C55E;color:#000000;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px;box-shadow:0 4px 14px rgba(34,197,94,0.3)">Reply Directly to User</a></td></tr>${footer('Automated Support Telemetry')}`, 560)
}

export const emailLinks = { app: APP_URL, habits: HABITS_URL }