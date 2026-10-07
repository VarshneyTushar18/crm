const { passwordVerfication } = require('@/emailTemplate/emailVerfication');
const {
  CustomerOnboarding,
  AnnouncementEmail,
} = require('@/emailTemplate/SendEmailTemplate');

const { Resend } = require('resend');

const sendMail = async ({
  email,
  name,
  link,
  idurar_app_email,
  subject,
  type = 'emailVerfication',
  emailToken,
  password, // for customer onboarding
  title, // announcement
  body, // announcement
}) => {
  try {
    // ✅ Dynamic subject handling
    if (!subject) {
      if (type === 'customerOnboarding') {
        subject = 'Your Customer Portal Login Details';
      } else if (type === 'announcement') {
        subject = title || 'Company notice';
      } else {
        subject = 'Verify your email | Idurar';
      }
    }

    // ✅ DEV MODE (NO EMAIL SEND)
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(60));
      console.log('📧 EMAIL (DEV MODE)');
      console.log('='.repeat(60));
      console.log(`To: ${email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Type: ${type}`);

      if (type === 'customerOnboarding') {
        console.log(`\n🔐 PASSWORD: ${password}`);
      }

      if (type === 'announcement') {
        console.log(`\n📝 Title: ${title || subject}`);
        console.log(`Body:\n${body || ''}`);
      }

      if (link) {
        console.log(`\n📍 CODE / LINK: ${link}`);
      }

      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        id: 'mock_' + Date.now(),
      };
    }

    // ✅ PROD MODE
    const resend = new Resend(process.env.RESEND_API);

    let html;

    if (type === 'customerOnboarding') {
      html = CustomerOnboarding({
        name,
        email,
        password,
        loginLink: link,
      });
    } else if (type === 'announcement') {
      html = AnnouncementEmail({
        title: title || subject,
        name,
        body: body || '',
      });
    } else {
      html = passwordVerfication({
        name,
        link,
      });
    }

    const { data, error } = await resend.emails.send({
      from: idurar_app_email || process.env.MAIL_FROM,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error('❌ Email Send Error:', error);
      return {
        success: false,
        error,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (err) {
    console.error('❌ sendMail Exception:', err.message);

    return {
      success: false,
      error: err.message,
    };
  }
};

module.exports = sendMail;
