import { mongo } from "mongoose";
import { Notification } from "../models/notification.model.js";

// GET all notifications for current user
const getNotifications = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: "Unauthorized" },
      });
    }

    const recipientType = req.user.role === "manager" ? "manager" : "worker";

    const notifications = await Notification.find({
      sentTo: req.user._id,
      recipientType: recipientType,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (notifications?.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No notifications found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({
      success: false,
      error: { message: "Failed to get notifications" },
    });
  }
};

// MARK as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: { message: "Notification ID is required" },
      });
    }

    if (!mongo.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { message: "Invalid Notification ID" },
      });
    }

    // Update the notification and return only the 'isRead' field
    const updated = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true, select: "isRead" }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { message: "Notification not found" },
      });
    }

    res.json({ success: true, data: { isRead: updated.isRead } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { message: "Failed to mark as read" },
    });
  }
};

// DELETE
const deleteNotification = async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({
        success: false,
        error: { message: "Notification ID is required" },
      });
    }
    if (mongo.ObjectId.isValid(req.params.id) === false) {
      return res.status(400).json({
        success: false,
        error: { message: "Invalid Notification ID" },
      });
    }

    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: { message: "Failed to delete" } });
  }
};

const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role === "manager" ? "manager" : "worker";

    if (!["worker", "manager"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid user role",
        },
      });
    }

    const result = await Notification.deleteMany({
      sentTo: userId,
      recipientType: role,
    });

    return res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} notifications`,
    });
  } catch (error) {
    console.error("Delete All Notifications Error:", error.message);
    return res.status(500).json({
      success: false,
      error: {
        message: "Failed to delete notifications",
      },
    });
  }
};

export {
  getNotifications,
  markAsRead,
  deleteNotification,
  deleteAllNotifications,
};
