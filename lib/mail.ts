// Send email via Microsoft Graph API (application permissions, Mail.Send)

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const fromEmail = process.env.INVITE_FROM_EMAIL ?? "hub-noreply@production-solutions.group";

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph email not configured — set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET");
  }

  // 1. Get access token
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get Graph token: ${err}`);
  }

  const { access_token } = await tokenRes.json();

  // 2. Send mail
  const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: to } }],
        from: { emailAddress: { address: fromEmail, name: "PSG Hub" } },
      },
      saveToSentItems: false,
    }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    throw new Error(`Failed to send email via Graph: ${err}`);
  }
}
