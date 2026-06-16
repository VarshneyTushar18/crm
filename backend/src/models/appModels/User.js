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
      enum: ["admin", "worker", "customer"],
      required: true,
    },

    workerId: {
      type: String,
      unique: true,
      sparse: true,
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
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.User || mongoose.model("User", UserSchema);