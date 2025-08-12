import Conversation from "../models/conversation.model.js";
import Lead from "../models/lead.model.js";
import mongoose from "mongoose";
import { Manager } from "../models/manager.model.js";
import { sendNotification } from "../utils/sendNotification.js";
import Category from "../models/categories.model.js";
import { Worker } from "../models/worker.models.js";

const endConversation = async (req, res) => {
  try {
    const leadId = req.params.id;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: { message: "Lead ID is required" },
      });
    }

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        error: { message: "Invalid Lead ID format" },
      });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: { message: "Lead not found" },
      });
    }

    const { conclusion, isProfitable } = req.body;

    if (
      !conclusion ||
      conclusion.trim() === "" ||
      typeof isProfitable !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        error: { message: "Conclusion and isProfitable are required" },
      });
    }

    const now = new Date();

    const newConversation = new Conversation({
      date: now,
      lead: lead._id,
      conclusion,
      isProfitable,
      user: req.user._id,
      addedBy: req.user._id,
    });

    await newConversation.save();

    if (!Array.isArray(lead.conversations)) lead.conversations = [];
    lead.conversations.push(newConversation._id);
    lead.isProfitable = isProfitable;
    lead.status = "closed";
    lead.lastContact = now;
    if (Array.isArray(lead.followUpDates)) {
      lead.followUpDates = lead.followUpDates.flat().map(String);
    }

    await lead.save();
    const managers = await Manager.find({}, "_id");

    // Prepare base notification payload
    const notificationPayload = {
      recipient: req.user._id,
      recipientType: req.user.role,
      title: "Conversation Ended",
      message: `The lead "${lead.name}" has been closed with a conclusion.`,
      type: "end-conversation",
      relatedTo: lead._id,
      relatedToType: "Conversation",
    };
     // notification logic
    if (req.user.role === "worker") {
      // Notify all managers
      for (const manager of managers) {
        await sendNotification({ ...notificationPayload, sentTo: manager._id });
      }

      // Also notify the worker themself if assigned
      if (lead.assignedTo) {
        await sendNotification({ ...notificationPayload, sentTo: lead.assignedTo });
      }
    } else if (req.user.role === "manager") {
      // Notify all managers
      for (const manager of managers) {
        await sendNotification({ ...notificationPayload, sentTo: manager._id });
      }

      // Also notify the worker assigned to the lead
      if (lead.assignedTo) {
        await sendNotification({ ...notificationPayload, sentTo: lead.assignedTo });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Conversation successfully closed with conclusion",
      data: {
        leadId: lead._id,
        conversation: newConversation,
      },
    });
  } catch (error) {
    console.error("Error in closeLeadWithConclusion:", error);
    return res.status(500).json({
      success: false,
      error: { message: "Internal Server Error" },
    });
  }
};

const createConversation = async (req, res) => {
  try {
    const { conclusion, isProfitable = null, followUpDate, date } = req.body;
    const { leadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID" });
    }

    const conversation = new Conversation({
      lead: leadId,
      date: date ? new Date(date) : new Date(),
      addedBy: req.user._id,
      conclusion,
      isProfitable,
      followUpDate,
    });

    await conversation.save();

    await Lead.findByIdAndUpdate(leadId, {
      $push: {
        conversations: conversation._id,
        followUpDates: followUpDate,
      },
      $set: {
        lastContact: new Date(),
      },
    });

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    console.error("Create Conversation Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getAllConversations = async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const filter = { isDeleted: false };
    if (req.user.role?.toLowerCase() !== "manager")
      filter.addedBy = req.user._id;

    const conversations = await Conversation.find(filter).lean();
    const leadIds = [
      ...new Set(conversations.map((c) => c.lead).filter(Boolean)),
    ];
    const userIds = [
      ...new Set(conversations.map((c) => c.addedBy).filter(Boolean)),
    ];

    const leads = await Lead.find({ _id: { $in: leadIds } }).lean();
    const categoryIds = [
      ...new Set(leads.map((l) => l.category).filter(Boolean)),
    ];
    const categories = await Category.find({
      _id: { $in: categoryIds },
    }).lean();

    const [workers, managers] = await Promise.all([
      Worker.find({ _id: { $in: userIds } })
        .select("name")
        .lean(),
      Manager.find({ _id: { $in: userIds } })
        .select("name")
        .lean(),
    ]);

    const allUsers = [...workers, ...managers];
    const leadMap = new Map(leads.map((l) => [String(l._id), l]));
    const categoryMap = new Map(categories.map((c) => [String(c._id), c]));
    const userMap = new Map(allUsers.map((u) => [String(u._id), u]));

    const result = conversations.map((convo) => {
      const lead = leadMap.get(String(convo.lead));
      const user = userMap.get(String(convo.addedBy));
      const cat = lead ? categoryMap.get(String(lead.category)) : null;

      const addedByRole = workers.find(
        (w) => String(w._id) === String(convo.addedBy)
      )
        ? "worker"
        : "manager";

      const userName = user?.name || user?.fullName || null;

      return {
        conversation: convo,
        meta: {
          leadName: lead?.name ?? null,
          leadId: lead?._id ?? null,
          followupDate: Array.isArray(lead?.followUpDates)
            ? lead.followUpDates[0]
            : null,
          status: lead?.status ?? null,

          [`${addedByRole}Name`]: userName,
          [`${addedByRole}Id`]: user?._id ?? null,

          categoryId: cat?._id ?? null,
          categoryTitle: cat?.title ?? null,
          categoryColor: cat?.color ?? null,
        },
      };
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getConversationsByLead = async (req, res) => {
  try {
    const { leadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const lead = await Lead.findById(leadId).lean();
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const isManager = req.user?.role === "manager";

    const baseFilter = {
      _id: { $in: lead.conversations },
    };

    const workerFilter = {
      ...baseFilter,
      isDeleted: false,
      addedBy: req.user._id,
    };

    const finalFilter = isManager ? baseFilter : workerFilter;

    const conversations = await Conversation.find(finalFilter)
      .sort({ date: -1 })
      .lean();

    res.status(200).json({
      success: true,
      id: lead._id,
      followUpDates: lead.followUpDates,
      notes: lead.notes,
      data: conversations,
    });
  } catch (error) {
    console.error("Get Conversations Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const getConversationsByWorker = async (req, res) => {
  try {
    const { workerId } = req.params;
    const loggedInUser = req.user;

    if (!mongoose.Types.ObjectId.isValid(workerId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid worker ID" });
    }

    const isManager = loggedInUser?.role === "manager";
    const isSelf = loggedInUser._id.toString() === workerId;

    // Only allow manager or the same worker
    if (!isManager && !isSelf) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized access" });
    }

    const filter = {
      addedBy: workerId,
      isDeleted: false,
    };

    const conversations = await Conversation.find(filter)
      .sort({ date: -1 })
      .lean();

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    console.error("Get Conversations By Worker Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const updateConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const { conclusion, isProfitable } = req.body;

    const updated = await Conversation.findByIdAndUpdate(
      id,
      { conclusion, isProfitable },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }
    // Fetch all managers
    const managers = await Manager.find({}, "_id");

    // Prepare base notification payload
    const notificationPayload = {
      recipient: req.user._id,
      recipientType: req.user.role,
      title: "Conversation Updated",
      message: `A conversation has been updated (ID: ${updated._id}).`,
      type: "update",
      relatedTo: updated._id,
      relatedToType: "Conversation",
    };

     if (req.user.role === "manager") {
      // Notify all managers
      for (const manager of managers) {
        await sendNotification({ ...notificationPayload, sentTo: manager._id });
      }

      // Also notify the worker (if exists)
      if (updated.addedBy) {
        await sendNotification({ ...notificationPayload, sentTo: updated.addedBy });
      }
    } else if (req.user.role === "worker") {
      //notify all managers
      for (const manager of managers) {
        await sendNotification({ ...notificationPayload, sentTo: manager._id });
      }
      if (updated.addedBy) {
        await sendNotification({ ...notificationPayload, sentTo: updated.addedBy });
      }
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Conversation Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;

    const convo = await Conversation.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedBy: req.user._id },
      { new: true }
    );
    if (!convo) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }
    // Fetch all managers
    const managers = await Manager.find({}, "_id");

    // Prepare base notification payload
    const notificationPayload = {
      recipient: req.user._id,
      recipientType: req.user.role,
      title: "Conversation Updated",
      message: `A conversation has been deleted (ID: ${convo._id}).`,
      type: "delete",
      relatedTo: convo._id,
      relatedToType: "Conversation",
    };

   // notificaton logic
    if (req.user.role === "manager") {
      // Notify all managers
      for (const manager of managers) {
        await sendNotification({ ...notificationPayload, sentTo: manager._id });
      }

      // Also notify the worker (if exists)
      if (convo.addedBy) {
        await sendNotification({ ...notificationPayload, sentTo: convo.addedBy });
      }
    } else if (req.user.role === "worker") {
      //  notify all managers
      for (const manager of managers) {
        await sendNotification({ ...notificationPayload, sentTo: manager._id });
      }
      // Also notify the worker (if exists)
      if (convo.addedBy) {
        await sendNotification({ ...notificationPayload, sentTo: convo.addedBy });
      }
    }
    res.status(200).json({ success: true, message: "Conversation deleted" });
  } catch (error) {
    console.error("Delete Conversation Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export {
  createConversation,
  getAllConversations,
  getConversationsByLead,
  getConversationsByWorker,
  endConversation,
  updateConversation,
  deleteConversation,
};
