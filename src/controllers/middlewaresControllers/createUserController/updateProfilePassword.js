const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generate: uniqueId } = require('shortid');

const updateProfilePassword = async (userModel, req, res) => {
  try {
    const UserPassword = mongoose.model(userModel + 'Password');
    const reqUserName = userModel.toLowerCase();
    const userProfile = req[reqUserName];

    let { password, passwordCheck, mode, oldPassword, otp } = req.body;

    if (!password || !passwordCheck) {
      return res.status(400).json({ success: false, message: 'Not all fields have been entered.' });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'The password needs to be at least 8 characters long.',
      });
    }

    if (password !== passwordCheck) {
      return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }

    const currentPasswordData = await UserPassword.findOne({ user: userProfile._id, removed: false });
    if (!currentPasswordData) {
      return res.status(404).json({ success: false, message: 'Password record not found.' });
    }

    // --- Verification Logic ---
    if (mode === 'password') {
      if (!oldPassword) {
        return res.status(400).json({ success: false, message: 'Old password is required.' });
      }
      const isMatch = bcrypt.compareSync(currentPasswordData.salt + oldPassword, currentPasswordData.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect current password.' });
      }
    } else if (mode === 'phoneOTP' || mode === 'emailOTP') {
      if (!otp) {
        return res.status(400).json({ success: false, message: 'OTP is required.' });
      }
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const otpField = mode === 'phoneOTP' ? 'phoneOTP' : 'emailOTP';
      const expiryField = mode === 'phoneOTP' ? 'phoneOTPExpires' : 'emailOTPExpires';

      if (currentPasswordData[otpField] !== otpHash || currentPasswordData[expiryField] < Date.now()) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
      }

      // Clear OTP after success
      await UserPassword.updateOne(
        { _id: currentPasswordData._id },
        { $unset: { [otpField]: 1, [expiryField]: 1 } }
      );
    } else {
      // Default to old password check if no mode provided (existing behavior but safer)
      return res.status(400).json({ success: false, message: 'Verification mode is required.' });
    }

    // --- Update Logic ---
    const salt = uniqueId();
    const passwordHash = bcrypt.hashSync(salt + password);

    if (userProfile.email === 'admin@admin.com') {
      return res.status(403).json({
        success: false,
        message: "You couldn't update demo password",
      });
    }

    await UserPassword.findOneAndUpdate(
      { user: userProfile._id },
      { $set: { password: passwordHash, salt: salt } },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = updateProfilePassword;
