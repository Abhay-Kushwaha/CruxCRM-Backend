import express from "express";
import {
  createLead,
  getAllLeads,
  getLeadById,
  updateLeadById,
  deleteLead,
  getLeads,
} from "../controllers/lead.controller.js";
import { endConversation } from "../controllers/consversation.controller.js";
import { assignedTo } from "../controllers/assignedTo.controller.js";
import checkAuth from "../middlewares/checkAuth.middleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { xlUpload } from "../middlewares/xlMulter.middleware.js";
import {
  addFollowUp,
  bulkUploadLeads,
} from "../controllers/leadOprations.controller.js";

const leadRouter = express.Router();

leadRouter.post(
  "/createlead",
  upload.array("documents", 5),
  checkAuth,
  createLead
);

// get leads by req.query
leadRouter.get("/getalllead", checkAuth, getAllLeads);
// all leads
leadRouter.get("/leads", checkAuth, getLeads);
leadRouter.get("/getlead/:id", checkAuth, getLeadById);
leadRouter.put(
  "/updateleads/:id",
  upload.array("documents", 5),
  checkAuth,
  updateLeadById
);
leadRouter.delete("/deletelead/:id", checkAuth, authorizeRoles("manager"), deleteLead);
leadRouter.post("/assign", checkAuth, authorizeRoles("manager"), assignedTo);
leadRouter.post(
  "/bulk-upload",
  checkAuth,
  xlUpload.single("file"),
  bulkUploadLeads
);

leadRouter.post("/:id/follow-up", checkAuth, addFollowUp);
leadRouter.put("/endconvo/:id", checkAuth, endConversation);
export default leadRouter;
