import express from "express";
import { createManager } from "../controllers/manager.seed.controller.js";

const router = express.Router();
router.post("/manager", createManager);

export default router;
