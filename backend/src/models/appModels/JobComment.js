const mongoose = require("mongoose");

const jobCommentSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    authorName: { type: String, trim: true, default: "" },
    authorRole: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, required: true },
    attachments: [
      {
        fileUrl: { type: String, trim: true, required: true },
        originalName: { type: String, trim: true, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.JobComment ||
  mongoose.model("JobComment", jobCommentSchema);
