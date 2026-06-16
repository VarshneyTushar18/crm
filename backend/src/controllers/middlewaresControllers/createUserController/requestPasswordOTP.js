const mongoose = require('mongoose');
const crypto = require('crypto');
const sendMail = require('@/controllers/middlewaresControllers/createAuthMiddleware/sendMail');

const requestPasswordOTP = async (userModel, req, res) => {
  try {
    const UserPassword = mongoose.model(userModel + 'Password');
    const AdminModel = mongoose.model(userModel);

    const reqUserName = userModel.toLowerCase();
    const userProfile = req[reqUserName]; // Provided by auth middleware

    const { method } = req.body; // 'phone' or 'email'

    if (!['phone', 'email'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification method. Use "phone" or "email".',
      });
    }

    const admin = await AdminModel.findById(userProfile._id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    if (method === 'phone' && !admin.phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number not found in profile. Please update your profile first.',
      });
    }

    if (method === 'email' && !admin.email) {
      return res.status(400).json({ success: false, message: 'Email not found.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

    const updateData = {};
    if (method === 'phone') {
      updateData.phoneOTP = otpHash;
      updateData.phoneOTPExpires = expires;
    } else {
      updateData.emailOTP = otpHash;
      updateData.emailOTPExpires = expires;
    }

    await UserPassword.findOneAndUpdate({ user: admin._id }, { $set: updateData }, { upsert: true });

    // Send OTP
    if (method === 'email') {
      await sendMail({
        email: admin.email,
        name: admin.name,
        subject: 'Your Password Verification Code',
        type: 'emailOTP',
        link: otp, // Using link field to pass OTP for simple template support
      });
    } else {
      // Simulate SMS Send
      console.log('\n' + '='.repeat(60));
      console.log('📱 SMS OTP (DEV MODE)');
      console.log('='.repeat(60));
      console.log(`To: ${admin.phone}`);
      console.log(`OTP: ${otp}`);
      console.log('='.repeat(60) + '\n');
    }

    return res.status(200).json({
      success: true,
      message: `Verification code sent to your ${method}.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = requestPasswordOTP;
