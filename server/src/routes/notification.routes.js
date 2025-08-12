import express from "express";
import {
  deleteAllNotifications,
  deleteNotification,
  getNotifications,
  markAsRead,
} from "../controllers/notification.controller.js";
import checkAuth from "../middlewares/checkAuth.middleware.js";

const router = express.Router();

router.get("/", checkAuth, getNotifications);
router.put("/mark-read/:id", checkAuth, markAsRead);
router.delete("/delete/:id", checkAuth, deleteNotification);
router.delete("/delete-all", checkAuth, deleteAllNotifications);

export default router;
