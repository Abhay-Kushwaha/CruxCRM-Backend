import express from "express";
import checkAuth from "../middlewares/checkAuth.middleware.js";
import { logout, userName } from "../controllers/currentUser.controller.js";

const router = express.Router();

router.get("/current", checkAuth, userName);
router.post("/logout", checkAuth, logout);

export default router;
