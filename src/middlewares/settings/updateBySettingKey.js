const mongoose = require('mongoose');

const updateBySettingKey = async ({ settingKey, settingValue }) => {
  try {
    const Model = mongoose.models.Setting || mongoose.model('Setting');
    if (!settingKey || !settingValue) {
      return null;
    }

    const result = await Model.findOneAndUpdate(
      { settingKey },
      {
        settingValue,
      },
      {
        new: true, // return the new result instead of the old one
        runValidators: true,
      }
    ).exec();
    // If no results found, return document not found
    if (!result) {
      return null;
    } else {
      // Return success resposne
      return result;
    }
  } catch {
    return null;
  }
};

module.exports = updateBySettingKey;
