import { Router } from "express";
import {
  loginWorker,
  registerWorker,
  resetPassword,
  sendOtp,
  verifyOtp,
  getWorkers,
  getDashboardData,
} from "../controllers/worker.controller.js";
import checkAuth from "../middlewares/checkAuth.middleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.middleware.js";

const router = Router();

//Worker Auth operations

router.post("/register", registerWorker);
router.post("/login", loginWorker);

// For forgot password
router.post("/forgot-password", sendOtp);
router.post("/verify-otp/:id", verifyOtp);
router.post("/reset-password/:id", resetPassword);
// get all workers
router.get(
  "/get-all-workers",
  checkAuth,
  authorizeRoles("manager"),
  getWorkers
);
// Get worker dashboard data
router.post("/dashboard", checkAuth, getDashboardData);

export default router;
