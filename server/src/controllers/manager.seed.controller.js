import { Manager } from "../models/manager.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { APIError } from "../utils/APIerror.js";

export const createManager = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password ) {
    throw new APIError(400, "Email, Password, and name are required");
  }

  const existing = await Manager.findOne({ email });
  if (existing) {
    throw new APIError(409, "Manager with this email already exists");
  }

  const manager = await Manager.create({ email, password, name });

  res.status(201).json({
    success: true,
    message: "Manager created successfully",
    manager: {
      email: manager.email,
      fullName: manager.name,
      role: manager.role,
      avatar: manager.avatar,
      id: manager._id,
    },
  });
});
