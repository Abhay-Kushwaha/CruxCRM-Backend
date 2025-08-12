import mongoose from "mongoose";
import { type } from "os";

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  phoneNumber: {
    type: Number,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  },
  position: {
    type: String,
  },
  leadSource: {
    type: String,
  },
  notes: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Manager",
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Worker",
  },
  campaignSent: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
    },
  ],
  status: {
    type: String,
    enum: ["new", "in-progress", "follow-up", "closed"],
    default: "new",
  },
  priority: {
    type: String,
    enum: ["high", "medium", "low"],
    default: "medium",
  },
  followUpDates: {
    type: [String],
    default: [],
  },
  lastContact: {
    type: Date,
  },
  documents: [
    {
      documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
      url: String,
      description: String,
      createdAt: { type: Date, default: Date.now },
      size: Number,
    },
  ],
  conversations: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: [],
    },
  ],
  isDeleted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Lead = mongoose.model("Lead", leadSchema);

export default Lead;
