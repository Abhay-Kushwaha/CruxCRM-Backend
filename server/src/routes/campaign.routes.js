import express from "express";
import checkAuth from "../middlewares/checkAuth.middleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.middleware.js";
import {
  createCampaign,
  deleteCampaign,
  getAllCampaigns,
  getCampaignById,
  sendCampaign,
  updateCampaign,
} from "../controllers/campaign.controller.js";

const campaignrouter = express.Router();

campaignrouter.post("/create", checkAuth,authorizeRoles("manager"), createCampaign);
campaignrouter.post("/send/:campaignId",authorizeRoles("manager"), checkAuth, sendCampaign);
campaignrouter.put("/update/:campaignId", checkAuth,authorizeRoles("manager"), updateCampaign);
campaignrouter.get("/all", checkAuth,authorizeRoles("manager"), getAllCampaigns);
campaignrouter.get("/:id", checkAuth,authorizeRoles("manager"), getCampaignById);
campaignrouter.delete("/delete/:id", checkAuth,authorizeRoles("manager"), deleteCampaign);

export default campaignrouter;
