import Lead from "../models/lead.model.js";
import Category from "../models/categories.model.js";
import Document from "../models/document.model.js";
import Conversation from "../models/conversation.model.js";
import xlsx from "xlsx";
import fs from "fs";
import mongoose from "mongoose";
import { sendNotification } from "../utils/sendNotification.js";
import { Manager } from "../models/manager.model.js";
import { Worker } from "../models/worker.models.js";

const bulkUploadLeads = async (req, res) => {
  try {
    const { category, assignedTo: onlyManager } = req.body;

    const role = req.user.role;
    const assignedTo = role === "manager" ? onlyManager || null : null;

    if (role == "manager" && assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          success: false,
          error: {
            message: "Invalid assignedTo ID format",
          },
        });
      }
      const isWorkerId = await Worker.exists({ _id: assignedTo });

      if (!isWorkerId) {
        return res.status(404).json({
          success: false,
          error: {
            message: "Assigned user not found in Worker list",
          },
        });
      }
    }
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          message: req.fileValidationError,
        },
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          message: "No file uploaded",
        },
      });
    }

    const workbook = xlsx.readFile(req.file.path);

    if (workbook.SheetNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Uploaded file is empty or invalid",
        },
      });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;
    const errors = [];
    let newLead;

    for (let i = 0; i < rows.length; i++) {
      totalProcessed++;
      const row = rows[i];

      if (!row.name || !row.email) {
        failed++;
        errors.push({
          row: i + 2,
          error: "Missing required field: name or email",
        });
        continue;
      }

      if (!/^\S+@\S+\.\S+$/.test(row.email)) {
        failed++;
        errors.push({
          row: i + 2,
          error: "Invalid email format",
        });
        continue;
      }
      const status = category && assignedTo ? "in-progress" : "new";

      try {
        newLead = await Lead({
          name: row.name,
          email: row.email.toLowerCase(),
          phoneNumber: row.phoneNumber || null,
          category,
          assignedTo: assignedTo || null,
          position: row.position || "",
          leadSource: row.leadSource || "",
          notes: row.notes || "",
          createdBy: req.user._id,
          status: status,
          priority: row.priority || "medium",
        });
        newLead.save();

        successful++;
      } catch (err) {
        console.error("Error creating lead:", err);
        failed++;
        errors.push({
          row: i + 2,
          error: "Database error or duplicate entry",
        });
      }
    }
    let categoryDoc = null;

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      categoryDoc = await Category.findById(category);
    }
    if (categoryDoc) {
      categoryDoc.isActive = true;
      await categoryDoc.save();
    }

    let recipientType = null;

    const isWorker = await Worker.exists({ _id: assignedTo });
    if (isWorker) {
      recipientType = "worker";
    } else {
      const isManager = await Manager.exists({ _id: assignedTo });
      if (isManager) {
        recipientType = "manager";
      }
    }

    if (assignedTo) {
      const notificationPayload = {
        recipient: req.user._id,
        recipientType,
        sentTo: assignedTo,
        title: "New Lead Assigned",
        message: `You have been assigned a new lead:`,
        type: "assignment",
        relatedTo: newLead._id,
        relatedToType: "Lead",
      };

      await sendNotification(notificationPayload);
    }
    const managers = await Manager.find({}, "_id");

    // Prepare base notification payload
    const notificationPayload = {
      recipient: req.user._id,
      recipientType: req.user.role,
      title: "Conversation Updated",
      message: `A lead has been assigned to (ID: ${assignedTo}).`,
      type: "update",
      relatedTo: assignedTo,
      relatedToType: "Conversation",
    };

    // Send to each manager
    for (const manager of managers) {
      await sendNotification({
        ...notificationPayload,
        sentTo: manager._id,
      });
    }

    // Delete uploaded file after processing
    fs.unlink(req.file.path, () => {});

    return res.status(201).json({
      success: true,
      response: {
        message: "Leads uploaded successfully!",
      },
      data: {
        totalProcessed,
        successful,
        failed,
        errors,
      },
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};

const addFollowUp = async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: "Lead ID is required" },
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { message: "Invalid Lead ID format" },
      });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: { message: "Lead not found" },
      });
    }

    const { followUpDate, conclusion, isProfitable = null } = req.body;

    if (
      (!isProfitable && (!followUpDate || followUpDate.trim() === "")) ||
      !conclusion ||
      conclusion.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        error: {
          message:
            "Conclusion and either follow-up date or profitability are required",
        },
      });
    }

    const followUpDateObj = new Date(followUpDate);
    const now = new Date();

    if (
      followUpDate &&
      (isNaN(followUpDateObj.getTime()) || followUpDateObj <= now)
    ) {
      return res.status(400).json({
        success: false,
        error: { message: "Follow-up date must be in the future" },
      });
    }

    const newConversation = new Conversation({
      date: now,
      lead: lead._id,
      conclusion: conclusion,
      isProfitable,
      addedBy: req.user._id,
    });

    await newConversation.save();

    if (!Array.isArray(lead.conversations)) lead.conversations = [];
    if (!Array.isArray(lead.followUpDates)) lead.followUpDates = [];

    lead.conversations.push(newConversation._id);
    lead.status = typeof isProfitable === "boolean" ? "closed" : "follow-up";
    lead.lastContact = now;
    lead.followUpDates.push(followUpDate);

    await lead.save();

    let recipientType = null;
    const isWorker = await Worker.exists({ _id: lead.assignedTo });
    if (isWorker) {
      recipientType = "worker";
    } else {
      const isManager = await Manager.exists({ _id: lead.assignedTo });
      if (isManager) {
        recipientType = "manager";
      }
    }

    if (recipientType) {
      //  Notification 1: New Follow-up Added
      await sendNotification({
        recipient: req.user._id,
        recipientType,
        sentTo: lead.assignedTo,
        title: "New Follow-up Added",
        message: "A new follow-up has been added for the lead",
        type: "follow-up",
        relatedTo: lead._id,
        relatedToType: "Lead",
      });

      //  Notification 2: Conversation Started
      await sendNotification({
        recipient: req.user._id,
        recipientType,
        sentTo: lead.assignedTo,
        title: "Conversation Started",
        message: "A conversation has been initiated for lead",
        type: "conversation",
        relatedTo: lead._id,
        relatedToType: "Lead",
      });
    }
    const managers = await Manager.find({}, "_id");

    // Prepare base notification payload
    const notificationPayload = {
      recipient: req.user._id,
      recipientType: req.user.role,
      title: "Conversation Started",
      message: "A conversation has been initiated for lead",
      type: "update",
      relatedTo: lead._id,
      relatedToType: "Conversation",
    };

    // Send to each manager
    for (const manager of managers) {
      await sendNotification({
        ...notificationPayload,
        sentTo: manager._id,
      });
    }

    return res.status(200).json({
      success: true,
      response: {
        message: "Follow-up added via conversation successfully!",
      },
      data: {
        leadId: lead._id,
        conversation: newConversation,
      },
    });
  } catch (error) {
    console.error("Error adding follow-up (conversation):", error);
    return res.status(500).json({
      success: false,
      error: { message: "Internal Server error" },
    });
  }
};

export { bulkUploadLeads, addFollowUp };
