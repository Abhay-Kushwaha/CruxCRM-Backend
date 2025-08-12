import { Manager } from "../models/manager.model.js";
import { Worker } from "../models/worker.models.js";
import Lead from "../models/lead.model.js";
import { Campaign } from "../models/campaign.model.js";
import { Notification } from "../models/notification.model.js";
import Conversation from "../models/conversation.model.js";

export const userName = async (req, res) => {
  try {
    const { _id, role } = req.user;

    let user = null;

    if (role === "manager") {
      user = await Manager.findById(_id).select("name email");
    } else if (role === "worker") {
      user = await Worker.findById(_id).select("name email");
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: "User not found",
        },
      });
    }

    res.status(200).json({
      success: true,
      response: {
        message: "Current user retrieved successfully",
      },
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role,
      },
    });
  } catch (err) {
    console.error("Error retrieving current user:", err);
    res.status(500).json({
      success: false,
      error: {
        message: "Internal Server Error",
      },
    });
  }
};

export const logout = (req, res) => {
  const cookies = req.cookies;

  const cookiesOption = {
    sameSite: "strict",
    httpOnly: false,
    secure: process.env.NODE_ENV !== "development",
    path: "/",
    domain: process.env.NODE_ENV === "development" ? "localhost" : ".indibus.net",
  };

  // Clear access token
  res.clearCookie("token", cookiesOption);

  // Dynamically clear any cookie that starts with "001" (worker) or "002" (manager)
  Object.keys(cookies).forEach((cookieName) => {
    if (cookieName.startsWith("001") || cookieName.startsWith("002")) {
      res.clearCookie(cookieName, cookiesOption);
    }
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully....!",
  });
};

