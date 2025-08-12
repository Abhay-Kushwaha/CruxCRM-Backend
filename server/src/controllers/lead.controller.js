import Lead from "../models/lead.model.js";
import Category from "../models/categories.model.js";
import Document from "../models/document.model.js";
import Conversation from "../models/conversation.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.models.js";
import xlsx from "xlsx";
import fs from "fs";
import mongoose from "mongoose";
import { sendNotification } from "../utils/sendNotification.js";
import { Manager } from "../models/manager.model.js";
import { Worker } from "../models/worker.models.js";
const createLead = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      category,
      position,
      leadSource,
      notes,
      status,
      priority,
      assignedTo,
    } = req.body;

    if (!name || (!email && !phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Name, email or phone are required",
        },
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid email format",
        },
      });
    }

    const existingLead = await Lead.findOne({ email });
    if (existingLead) {
      return res.status(409).json({
        success: false,
        error: {
          message: "Lead with this email already exists",
        },
      });
    }

    let categoryDoc = null;

    if (category) {
      // Validate category as a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
          success: false,
          error: "Invalid category ID",
        });
      }

      // Find the category by ID
      categoryDoc = await Category.findById(category);
      if (!categoryDoc) {
        return res.status(400).json({
          success: false,
          error: "Category not found",
        });
      }
    }
    const documentRefs = [];

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const result = await uploadOnCloudinary(file.path);
        if (result?.secure_url) {
          // Create a new Document in DB
          const doc = await Document.create({
            url: result.secure_url,
            size: file.size,
            description: req.body.description || file.originalname,
          });

          documentRefs.push(doc);
        }
      }
    }

    const newLead = new Lead({
      name,
      email,
      phoneNumber,
      category: categoryDoc?._id || undefined,
      position,
      leadSource,
      notes,
      status,
      priority,
      documents: documentRefs,
      assignedTo: assignedTo || null,
    });

    // to set the isActive true for category is assigned
    await newLead.save();
    if (categoryDoc) {
      categoryDoc.isActive = true;
      await categoryDoc.save();
    }
    await newLead.populate({
      path: "documents",
      select: "url description size createdAt _id",
    });

    // If the lead is assigned to someone, send a notification
    // Notify the assigned user (if any)
    if (assignedTo) {
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

      if (recipientType) {
        await sendNotification({
          recipient: req.user._id,
          recipientType,
          sentTo: assignedTo,
          title: "New Lead Assigned",
          message: `You have been assigned a new lead: ${newLead.name}`,
          type: "lead",
          relatedTo: newLead._id,
          relatedToType: "Lead",
        });
      }
    }

    // Notify all managers
    const allManagers = await Manager.find({}, "_id");

    await Promise.all(
      allManagers.map((manager) =>
        sendNotification({
          recipient: req.user._id,
          recipientType: "manager",
          sentTo: manager._id,
          title: "New Lead Created",
          message: `A new lead "${newLead.name}" has been created.`,
          type: "lead",
          relatedTo: newLead._id,
          relatedToType: "Lead",
        })
      )
    );

    return res.status(201).json({
      success: true,
      response: {
        message: "Lead created successfully!",
      },
      data: newLead,
    });
  } catch (error) {
    console.error("Create Lead Error:", error);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};

const getAllLeads = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, priority, category } = req.query;
    const filter = { isDeleted: false };

    if (req.user?.role === "worker") {
      filter.assignedTo = req.user._id;
    }
    // Optional Filters
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;

    const totalLeads = await Lead.countDocuments(filter);

    const leads = await Lead.find(filter)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate("category", "title color description _id")
      .populate("createdBy", "name _id")
      .populate("assignedTo", "name _id")
      .lean();

    // Transform data to match response format
    const formattedLeads = leads.map((lead) => ({
      id: lead._id,
      name: lead.name,
      email: lead.email,
      phoneNumber: lead.phoneNumber,
      category: lead.category && {
        id: lead.category._id,
        title: lead.category.title,
        color: lead.category.color,
        description: lead.category.description,
      },
      documents: (lead.documents || []).map((doc) => ({
        id: doc._id,
        url: doc.url,
        description: doc.description,
        size: doc.size,
        createdAt: doc.createdAt,
      })),
      position: lead.position,
      leadSource: lead.leadSource,
      notes: lead.notes,
      createdBy: lead.createdBy && {
        id: lead.createdBy._id,
        name: lead.createdBy.name,
      },
      assignedTo: lead.assignedTo && {
        id: lead.assignedTo._id,
        name: lead.assignedTo.name,
      },
      status: lead.status,
      priority: lead.priority,
      followUpDates: lead.followUpDates,
      lastContact: lead.lastContact,
      isDeleted: lead.isDeleted,
      createdAt: lead.createdAt,
    }));

    const totalPages = Math.ceil(totalLeads / limit);

    return res.status(200).json({
      success: true,
      response: {
        message: "Leads retrieved successfully!",
      },
      data: {
        leads: formattedLeads,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLeads,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get All Leads Error:", error);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};

const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find({ isDeleted: false })
      .populate("category")
      .populate({
        path: "assignedTo",
        model: "Worker",
        select: "name _id",
      });
    if (!leads || leads.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "No leads found",
        },
      });
    }
    const formattedLeads = leads.map((lead) => ({
      ...lead.toObject(),
      category: lead.category && {
        id: lead.category._id,
        title: lead.category.title,
        color: lead.category.color,
        description: lead.category.description,
      },
      assignedTo: lead.assignedTo && {
        id: lead.assignedTo._id,
        name: lead.assignedTo.name,
      },
    }));

    res.status(200).json({
      success: true,
      data: formattedLeads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
      },
    });
  }
};

const getLeadById = async (req, res) => {
  try {
    const leadId = req.params.id;
    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Lead ID is required",
        },
      });
    }

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid Lead ID format",
        },
      });
    }

    const lead = await Lead.findOne({ _id: leadId, isDeleted: false })
      .populate("category", "title description color _id")
      .populate("createdBy", "name email _id")
      .populate("assignedTo", "name email _id")
      .populate({
        path: "campaignSent",
        select: "title type _id",
      })
      .populate({
        path: "documents",
        select: "url description size createdAt _id",
      })
      .populate({
        path: "conversations",
        select: "date conclusion isProfitable followUpDate addedBy _id",
      })
      .lean();

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Lead not found",
        },
      });
    }

    const formattedLead = {
      id: lead._id,
      name: lead.name,
      email: lead.email,
      phoneNumber: lead.phoneNumber,
      category: lead.category && {
        id: lead.category._id,
        title: lead.category.title,
        description: lead.category.description,
        color: lead.category.color,
      },
      documents: (lead.documents || []).map((doc) => ({
        id: doc._id,
        url: doc.url,
        description: doc.description,
        size: doc.size,
        createdAt: doc.createdAt,
      })),
      position: lead.position,
      leadSource: lead.leadSource,
      notes: lead.notes,
      createdBy: lead.createdBy && {
        id: lead.createdBy._id,
        name: lead.createdBy.name,
        email: lead.createdBy.email,
      },
      assignedTo: lead.assignedTo && {
        id: lead.assignedTo._id,
        name: lead.assignedTo.name,
        email: lead.assignedTo.email,
      },
      campaignSent: (lead.campaignSent || []).map((c) => ({
        id: c._id,
        title: c.title,
        type: c.type,
      })),
      status: lead.status,
      priority: lead.priority,
      followUpDates: lead.followUpDates,
      lastContact: lead.lastContact,
      documents: (lead.documents || []).map((doc) => ({
        id: doc._id,
        url: doc.url,
        description: doc.description,
        size: doc.size,
        createdAt: doc.createdAt,
      })),
      conversations: (lead.conversations || []).map((conv) => ({
        id: conv._id,
        date: conv.date,
        conclusion: conv.conclusion,
        isProfitable: conv.isProfitable,
        followUpDate: conv.followUpDate,
        addedBy: conv.addedBy,
      })),
      isDeleted: lead.isDeleted,
      createdAt: lead.createdAt,
    };

    return res.status(200).json({
      success: true,
      response: {
        message: "Lead retrieved successfully!",
      },
      data: formattedLead,
    });
  } catch (error) {
    console.error("Get Lead by ID Error:", error);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};

const updateLeadById = async (req, res) => {
  try {
    const leadId = req.params.id;
    const {
      name,
      email,
      phoneNumber,
      category,
      position,
      leadSource,
      notes,
      status,
      priority,
      followUpDates,
      lastContact,
      documents,
    } = req.body;

    if (
      !name &&
      !email &&
      !phoneNumber &&
      !category &&
      !position &&
      !leadSource &&
      !notes &&
      !status &&
      !priority
    ) {
      return res.status(400).json({
        success: false,
        error: {
          message: "At least one field is required to update the lead",
        },
      });
    }

    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Lead ID is required",
        },
      });
    }
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid Lead ID format",
        },
      });
    }
    // Check for valid email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid email format",
        },
      });
    }

    // Validate status and priority
    const validStatus = ["new", "in-progress", "follow-up", "closed"];
    const validPriority = ["high", "medium", "low"];

    if (status && !validStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          message:
            "Invalid status. Must be one of: new, in-progress, follow-up, closed",
        },
      });
    }

    if (priority && !validPriority.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid priority. Must be one of: high, medium, low",
        },
      });
    }

    // Check if lead exists
    const existingLead = await Lead.findById(leadId);
    if (!existingLead || existingLead.isDeleted) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Lead not found",
        },
      });
    }

    // Check if email already exists on another lead
    if (email) {
      const duplicate = await Lead.findOne({
        _id: { $ne: leadId },
        email,
        isDeleted: false,
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: {
            message: "Lead with this email already exists",
          },
        });
      }
    }

    // Check if category exists
    if (category && !(await Category.findById(category))) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Category not found",
        },
      });
    }

    // Update lead
    const updateData = {
      name,
      email,
      phoneNumber,
      category,
      position,
      leadSource,
      notes,
      status,
      priority,
      followUpDates,
      lastContact,
      documents: existingLead.documents || [],
    };

    // Upload new documents if any
    const documentRefs = [];

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const result = await uploadOnCloudinary(file.path);
        if (result?.secure_url) {
          const doc = await Document.create({
            url: result.secure_url,
            size: file.size,
            description: req.body.description || file.originalname,
          });
          documentRefs.push(doc);
        }
      }
    }

    // Replace old documents with new ones
    if (documentRefs.length > 0) {
      updateData.documents = documentRefs;
    }

    await Lead.findByIdAndUpdate(leadId, updateData, { new: true });

    // Send notification to the assigned user (if assignedTo exists)
    if (existingLead.assignedTo) {
      let recipientType = null;
      const isWorker = await Worker.exists({ _id: existingLead.assignedTo });
      if (isWorker) {
        recipientType = "worker";
      } else {
        const isManager = await Manager.exists({
          _id: existingLead.assignedTo,
        });
        if (isManager) {
          recipientType = "manager";
        }
      }

      if (recipientType) {
        await sendNotification({
          recipient: req.user._id,
          recipientType,
          sentTo: existingLead.assignedTo,
          title: "Lead Updated",
          message: `The lead "${existingLead.name}" assigned to you has been updated.`,
          type: "update",
          relatedTo: existingLead._id,
          relatedToType: "Lead",
        });
      }
    }

    // Send notification to all managers
    const allManagers = await Manager.find({}, "_id");

    await Promise.all(
      allManagers.map((manager) =>
        sendNotification({
          recipient: req.user._id,
          recipientType: "manager",
          sentTo: manager._id,
          title: "Lead Updated",
          message: `The lead "${existingLead.name}" has been updated.`,
          type: "update",
          relatedTo: existingLead._id,
          relatedToType: "Lead",
        })
      )
    );

    return res.status(200).json({
      success: true,
      response: {
        message: "Lead updated successfully!",
      },
      data: null,
    });
  } catch (error) {
    console.error("Update Lead Error:", error);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};

const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findOne({ _id: id, isDeleted: false });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Lead not found",
        },
      });
    }

    if (lead.assignedTo) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Cannot delete lead with active assignments",
        },
      });
    }
    if (lead.assignedTo) {
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

      const notificationPayload = {
        recipient: req.user._id,
        recipientType,
        sentTo: lead.assignedTo,
        title: "Lead Assignment Removed",
        message: `The lead "${lead.name}" assigned to you has been deleted.`,
        type: "delete",
        relatedTo: lead._id,
        relatedToType: "Lead",
      };

      await sendNotification(notificationPayload);
    }

    lead.isDeleted = true;
    await lead.save();

    return res.status(200).json({
      success: true,
      response: {
        message: "Lead deleted successfully!",
      },
      data: null,
    });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};

export {
  createLead,
  getAllLeads,
  getLeadById,
  updateLeadById,
  deleteLead,
  getLeads,
};
