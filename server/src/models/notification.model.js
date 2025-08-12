import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "recipientType",
    },
    recipientType: {
      type: String,
      enum: ["worker", "manager"],
      required: true,
    },
    sentTo: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "recipientType",
    },
    title: String,
    message: String,
    type: {
      type: String,
      enum: [
        "assignment",
        "conversation",
        "lead",
        "new-lead",
        "campaign",
        "follow-up",
        "update",
        "delete",
        "end-conversation",
      ],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
