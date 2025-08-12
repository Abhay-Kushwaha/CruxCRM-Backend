import Assignment from "../models/assignment.model.js";
import Lead from "../models/lead.model.js";
import { Worker } from "../models/worker.models.js";
import Category from "../models/categories.model.js";
import mongoose from "mongoose";
import { sendNotification } from "../utils/sendNotification.js";
import { Manager } from "../models/manager.model.js";

const assignedTo = async (req, res) => {
  try {
    const {
      leadIds,
      assignedTo,
      priority = "medium",
      notes,
      dueDate,
      categoryId,
    } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "At least one lead ID must be provided" },
      });
    }

    for (const id of leadIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: 400, message: `Invalid lead ID: ${id}` },
        });
      }
    }

    if (!assignedTo || !mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "Invalid or missing worker ID" },
      });
    }

    const allowedPriorities = ["low", "medium", "high", "urgent"];
    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message:
            "Invalid priority. Must be one of: low, medium, high, urgent",
        },
      });
    }

    if (dueDate && new Date(dueDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "Due date must be in the future" },
      });
    }

    let finalCategoryId = null;
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({
          success: false,
          error: { code: 400, message: `Invalid category ID` },
        });
      }

      const categoryDoc = await Category.findById(categoryId);
      if (!categoryDoc) {
        return res.status(404).json({
          success: false,
          error: { code: 404, message: `Category not found` },
        });
      }

      finalCategoryId = categoryDoc._id;
    }

    const worker = await Worker.findById(assignedTo);
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: "Worker not found" },
      });
    }

    // Check if leads are already assigned
    for (const leadId of leadIds) {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        return res.status(404).json({
          success: false,
          error: { code: 404, message: `Lead not found: ${leadId}` },
        });
      }

      if (lead.assignedTo) {
        if (lead.assignedTo.toString() === assignedTo) {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: `Lead ${leadId} is already assigned to this worker`,
            },
          });
        } else {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: `Lead ${leadId} is already assigned to another worker`,
            },
          });
        }
      }
    }

    const assignment = new Assignment({
      createdBy: req.user._id,
      assignedTo: worker._id,
      category: finalCategoryId || null,
      leads: leadIds,
      priority,
      notes,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: "active",
    });

    await assignment.save();

    // Update the category to active if it exists
    const categoryDoc = await Category.findById(finalCategoryId);
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

    const notificationData = {
      recipient: req.user._id,
      recipientType,
      sentTo: worker._id,
      title: "New Lead Assignment",
      message: `You have been assigned new leads with priority ${priority}.`,
      type: "assignment",
      relatedTo: assignment._id,
      relatedToType: "Assignment",
    };
    // Send notification to the worker
    await sendNotification(notificationData);

    for (const leadId of leadIds) {
      const lead = await Lead.findById(leadId);
      lead.assignedTo = worker._id;
      if (finalCategoryId) lead.category = finalCategoryId;
      if (dueDate) lead.dueDate = new Date(dueDate);
      lead.status = "in-progress";

      await lead.save();
    }

    return res.status(200).json({
      success: true,
      response: {
        code: 200,
        message: "Leads assigned successfully!",
      },
      data: {
        assignmentId: assignment._id,
        assignedTo: worker._id,
        priority,
        dueDate,
        notes,
        leads: leadIds,
      },
    });
  } catch (error) {
    console.error("Error assigning leads:", error);
    return res.status(500).json({
      success: false,
      error: { code: 500, message: "Internal Server Error" },
    });
  }
};

export { assignedTo };
