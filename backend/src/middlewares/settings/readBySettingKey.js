const mongoose = require('mongoose');

const readBySettingKey = async ({ settingKey }) => {
  try {
    const Model = mongoose.models.Setting || mongoose.model('Setting');
    // Find document by id

    if (!settingKey) {
      return null;
    }

    const result = await Model.findOne({ settingKey });
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

module.exports = readBySettingKey;
