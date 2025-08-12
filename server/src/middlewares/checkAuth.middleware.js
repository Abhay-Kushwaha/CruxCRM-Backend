import jwt from "jsonwebtoken";
import { Worker } from "../models/worker.models.js";
import { Manager } from "../models/manager.model.js";

const checkAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: "Unauthorized access, token is missing",
        },
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Try finding the user in Manager first
    let user = await Manager.findById(decoded._id);
    let role = "manager";

    // If not found in Manager, try Worker
    if (!user) {
      user = await Worker.findById(decoded._id);
      role = "worker";
    }

    // If still not found
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: "No user exists",
        },
      });
    }

    // Attach a normalized user object with role
    req.user = {
      _id: user._id,
      role, // 'manager' or 'worker'
    };

    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};

export default checkAuth;
