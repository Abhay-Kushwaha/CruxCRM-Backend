import express from "express";
import {
  loginManager,
  resetPASS,
  sendOTP,
  verifyOTP,
  getDashboardData
} from "../controllers/manager.controller.js";
// import {  } from "../controllers/currentUser.controller.js";
import authorizeRoles from "../middlewares/authorizeRoles.middleware.js";
import checkAuth from "../middlewares/checkAuth.middleware.js";
// import { loginManager } from "../controllers/manager.controller.js";

const managerRouter = express.Router();

managerRouter.post("/login", loginManager);
managerRouter.post("/forgot-manager", sendOTP);
managerRouter.post("/verify/:id", verifyOTP);
managerRouter.post("/reset/:id", resetPASS);

managerRouter.post("/dashboard", checkAuth,authorizeRoles("manager"), getDashboardData);


export default managerRouter;
