const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = mongoose.models.User;
const sendMail = require('./middlewaresControllers/createAuthMiddleware/sendMail');

const getUserIdFromReq = (req) => {
  // your auth middleware may attach user info differently
  return (
    req.admin?._id ||
    req.user?._id ||
    req.auth?._id ||
    req.auth?.id ||
    req.userId ||
    null
  );
};

exports.getMe = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const me = await User.findById(userId).select(
      "-password -resetPasswordTokenHash -resetPasswordExpires"
    );

    if (!me) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({ success: true, result: me });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const allowed = ["name", "companyName", "email", "mobile"];
    const update = {};

    allowed.forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });

    const updated = await User.findByIdAndUpdate(userId, update, { new: true }).select(
      "-password -resetPasswordTokenHash -resetPasswordExpires"
    );

    return res.json({ success: true, result: updated, message: "Profile updated" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { password, passwordCheck, mode, oldPassword, otp } = req.body;

    if (!password || !passwordCheck) {
      return res.status(400).json({ success: false, message: "New password and confirmation are required" });
    }

    if (password !== passwordCheck) {
      return res.status(400).json({ success: false, message: "New passwords do not match" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // --- Verification Logic ---
    if (mode === 'password') {
      if (!oldPassword) {
        return res.status(400).json({ success: false, message: "Current password is required" });
      }
      const valid = await bcrypt.compare(oldPassword, user.password || "");
      if (!valid) return res.status(400).json({ success: false, message: "Current password is incorrect" });
    } else if (mode === 'phoneOTP' || mode === 'emailOTP') {
      if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required" });
      }
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const otpField = mode === 'phoneOTP' ? 'phoneOTP' : 'emailOTP';
      const expiryField = mode === 'phoneOTP' ? 'phoneOTPExpires' : 'emailOTPExpires';

      if (user[otpField] !== otpHash || user[expiryField] < Date.now()) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      }

      // Clear OTP after success
      user[otpField] = undefined;
      user[expiryField] = undefined;
    } else {
      return res.status(400).json({ success: false, message: "Verification mode is required" });
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.requestPasswordOTP = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { method } = req.body; // 'phone' or 'email'

    if (!['phone', 'email'].includes(method)) {
      return res.status(400).json({ success: false, message: "Invalid verification method" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // ✅ Requirement: Check if email/phone exists
    if (method === 'email' && !user.email) {
      return res.status(400).json({ success: false, message: "Email not found in your profile" });
    }

    if (method === 'phone' && !user.mobile) {
      return res.status(400).json({ success: false, message: "Mobile number not found in your profile" });
    }

    const targetContact = method === 'email' ? user.email : user.mobile;
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

    const otpField = method === 'phone' ? 'phoneOTP' : 'emailOTP';
    const expiryField = method === 'phone' ? 'phoneOTPExpires' : 'emailOTPExpires';

    user[otpField] = otpHash;
    user[expiryField] = expires;
    await user.save();

    // Send OTP
    if (method === 'email') {
      await sendMail({
        email: user.email,
        name: user.name,
        subject: 'Your Password Verification Code',
        type: 'emailOTP',
        link: otp, 
      });
    } else {
      // Simulate SMS
      console.log('\n' + '='.repeat(60));
      console.log('📱 CUSTOMER PORTAL SMS OTP (DEV MODE)');
      console.log('='.repeat(60));
      console.log(`To: ${user.mobile}`);
      console.log(`OTP: ${otp}`);
      console.log('='.repeat(60) + '\n');
    }

    return res.json({
      success: true,
      message: `Verification code sent successfully to ${targetContact}`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};