exports.SendInvoice = ({ title = 'Invoice from Idurar', name = '', time = new Date() }) => {
  return `
    <div>
        <head data-id="__react-email-head">
            <meta http-equiv="Content-Type" content="text/html; charset="UTF-8" />
            <title>${title}</title>
        </head>
        <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
            Your invoice - Idurar
        </div>

        <body data-id="__react-email-body">
            <h2 data-id="react-email-heading">${title}</h2>
            <hr data-id="react-email-hr" style="width:100%;border:none;border-top:1px solid #eaeaea" />
            <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">
                Hello ${name},
            </p>
            <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">
                Here's the invoice you requested at ${time}
            </p>
        </body>
    </div>
    `;
};

exports.SendQuote = ({ title = 'Quote from Idurar', name = '', time = new Date() }) => {
  return `
    <div>
        <head data-id="__react-email-head">
            <meta http-equiv="Content-Type" content="text/html; charset="UTF-8" />
            <title>${title}</title>
        </head>
        <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
            Your quote - Idurar
        </div>

        <body data-id="__react-email-body">
            <h2 data-id="react-email-heading">${title}</h2>
            <hr data-id="react-email-hr" style="width:100%;border:none;border-top:1px solid #eaeaea" />
            <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">
                Hello ${name},
            </p>
            <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">
                Here's the quote you requested at ${time}
            </p>
        </body>
    </div>
    `;
};

exports.SendOffer = ({ title = 'Offer from Idurar', name = '', time = new Date() }) => {
  return `
    <div>
        <head data-id="__react-email-head">
            <meta http-equiv="Content-Type" content="text/html; charset="UTF-8" />
            <title>${title}</title>
        </head>
        <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
            Your offer - Idurar
        </div>

        <body data-id="__react-email-body">
            <h2 data-id="react-email-heading">${title}</h2>
            <hr data-id="react-email-hr" style="width:100%;border:none;border-top:1px solid #eaeaea" />
            <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">
                Hello ${name},
            </p>
            <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">
                Here's the offer you requested at ${time}
            </p>
        </body>
    </div>
    `;
};

exports.SendPaymentReceipt = ({
  title = 'Payment Receipt from Idurar',
  name = '',
  time = new Date(),
}) => {
  return `
    <div>
        <head data-id="__react-email-head">
            <meta http-equiv="Content-Type" content="text/html; charset="UTF-8" />
            <title>${title}</title>
        </head>
        <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
            Your Payment Receipt - Idurar
        </div>

        <body data-id="__react-email-body">
            <h2 data-id="react-email-heading">${title}</h2>
            <hr data-id="react-email-hr" style="width:100%;border:none;border-top:1px solid #eaeaea" />
            <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">
                Hello ${name},
            </p>
            <p data-id="react-email-text" style="font-size:14px;line-height:24px;margin:16px 0">
                Here's the Payment Receipt you requested at ${time}
            </p>
        </body>
    </div>
    `;
};

exports.CustomerOnboarding = ({
  title = 'Welcome to Bright Balustrading - Your Customer Portal Account is Ready',
  name = '',
  email = '',
  password = '',
  loginLink = '',
  time = new Date(),
}) => {
  return `
    <div style="background-color:#f6f8fb;padding:24px 0;margin:0;">
      <head data-id="__react-email-head">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>${title}</title>
      </head>

      <div
        id="__react-email-preview"
        style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0"
      >
        Your customer portal login details are ready.
      </div>

      <body data-id="__react-email-body" style="margin:0;padding:0;background-color:#f6f8fb;">
        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eaeaea;font-family:Arial,sans-serif;"
        >
          <tr>
            <td style="background:#1890ff;padding:24px 32px;color:#ffffff;">
              <h2 style="margin:0;font-size:24px;line-height:32px;">${title}</h2>
              <p style="margin:8px 0 0 0;font-size:14px;line-height:22px;opacity:0.95;">
                Account created on ${time}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <p style="font-size:15px;line-height:24px;margin:0 0 16px 0;">
                Hello ${name || 'Customer'},
              </p>

              <p style="font-size:15px;line-height:24px;margin:0 0 16px 0;color:#333;">
                Welcome to Bright Balustrading. Your customer portal account has been created successfully.
                You can now log in to view your project updates, payment details, and contact our team.
              </p>

              <div style="margin:24px 0;padding:20px;background:#fafafa;border:1px solid #e8e8e8;border-radius:10px;">
                <h3 style="margin:0 0 16px 0;font-size:16px;color:#111;">Login Details</h3>

                <p style="margin:0 0 10px 0;font-size:14px;line-height:22px;color:#333;">
                  <strong>Email:</strong> ${email || '-'}
                </p>

                <p style="margin:0 0 10px 0;font-size:14px;line-height:22px;color:#333;">
                  <strong>Password:</strong> ${password || '-'}
                </p>

                <p style="margin:0;font-size:14px;line-height:22px;color:#333;">
                  <strong>Portal Link:</strong>
                  <a href="${loginLink}" target="_blank" style="color:#1890ff;text-decoration:none;">
                    ${loginLink || '#'}
                  </a>
                </p>
              </div>

              <div style="margin:24px 0;">
                <a
                  href="${loginLink}"
                  target="_blank"
                  style="display:inline-block;background-color:#1890ff;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:600;"
                >
                  Login to Customer Portal
                </a>
              </div>

              <p style="font-size:14px;line-height:22px;margin:0 0 16px 0;color:#c62828;font-weight:600;">
                For security, please change your password after your first login.
              </p>

              <p style="font-size:14px;line-height:22px;margin:0 0 10px 0;color:#555;">
                If you face any issue while logging in, please contact our support team.
              </p>

              <p style="font-size:14px;line-height:22px;margin:24px 0 0 0;color:#333;">
                Best regards,<br />
                Bright Balustrading Team
              </p>
            </td>
          </tr>
        </table>
      </body>
    </div>
  `;
};