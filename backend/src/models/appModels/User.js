const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    companyName: {
      type: String,
      required: function () {
        return this.role === "customer";
      },
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    mobile: {
      type: String,
      required: function () {
        return this.role === "customer";
      },
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "worker", "customer", "siteEngineer"],
      required: true,
    },

    workerId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    resetPasswordTokenHash: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    phoneOTP: String,
    phoneOTPExpires: Date,
    emailOTP: String,
    emailOTPExpires: Date,
    loginOtpHash: {
      type: String,
      default: null,
    },
    loginOtpExpires: {
      type: Date,
      default: null,
    },
    loginOtpResendAt: {
      type: Date,
      default: null,
    },
    boundDeviceId: {
      type: String,
      default: "",
      trim: true,
    },
    boundDeviceLabel: {
      type: String,
      default: "",
      trim: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.User || mongoose.model("User", UserSchema);