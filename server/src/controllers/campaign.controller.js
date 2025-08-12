import mongoose from "mongoose";
import { Campaign } from "../models/campaign.model.js";
import Lead from "../models/lead.model.js";
import sendEmail from "../utils/mailer.js";
import { sendSMS } from "../utils/sms.js";
import { getEmailTemplate } from "../templates/emil.template.js";

const createCampaign = async (req, res) => {
  try {
    const { leadIds, title, description, type, category, subject } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: "At least one lead ID must be provided" },
      });
    }

    for (const id of leadIds) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { message: `Invalid lead ID: ${id}` },
        });
      }
    }

    if (!title || !type || !description) {
      return res.status(400).json({
        success: false,
        message: "Title ,type and description are required.",
      });
    }
    const leads = await Lead.find({ _id: { $in: leadIds }, isDeleted: false });

    if (!leads || leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No valid leads found.",
      });
    }

    const campaign = await Campaign.create({
      title,
      subject,
      description,
      type,
      sentTo: leads.map((l) => l._id),
      category,
      createdBy: req.user._id,
      status: "draft",
    });

    return res.status(201).json({
      success: true,
      message: `Campaign created and messages sent.`,
      data: campaign,
    });
  } catch (error) {
    console.error("Error creating campaign for one lead:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const sendCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID",
      });
    }

    const campaign = await Campaign.findById(campaignId).populate("sentTo");
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    const skippedLeads = [];
    const sentLeads = [];

    for (const lead of campaign.sentTo) {
      if (campaign.type === "mail" && lead.email) {
        await sendEmail({
          to: lead.email,
          subject: campaign.subject || "",
          html: getEmailTemplate({
            subject: campaign.subject,
            description: campaign.description,
            leadName: lead.name,
          }),
        });
        sentLeads.push(lead._id);
      } else if (campaign.type === "sms" && lead.phoneNumber) {
        await sendSMS(
          lead.phoneNumber,
          `${campaign.title}: ${campaign.description}`
        );
        sentLeads.push(lead._id);
        console.log(`SMS sent to ${lead.phoneNumber}`);
      } else {
        skippedLeads.push({
          leadId: lead._id,
          name: lead.name,
          reason: "Missing email or phone number",
        });
      }
    }

    campaign.status = "sent";
    await campaign.save();

    return res.status(200).json({
      success: true,
      message: "Campaign messages sent successfully",
      sentCount: sentLeads.length,
      skippedCount: skippedLeads.length,
      skippedLeads,
    });
  } catch (error) {
    console.error("Send Campaign Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const updateCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { title, subject, description, type, category, leadIds, status } =
      req.body;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    if (campaign.status === "sent") {
      return res.status(400).json({
        success: false,
        message: "Cannot update a campaign that has already been sent.",
      });
    }

    // Validate new leadIds if provided
    let validLeads = [];
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      for (const id of leadIds) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ success: false, message: `Invalid lead ID: ${id}` });
        }
      }

      validLeads = await Lead.find({ _id: { $in: leadIds }, isDeleted: false });

      if (validLeads.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No valid leads found" });
      }

      // Update lead records with campaign ID if not already present
      for (const lead of validLeads) {
        lead.campaignSent = lead.campaignSent || [];
        if (!lead.campaignSent.includes(campaign._id)) {
          lead.campaignSent.push(campaign._id);
          await lead.save();
        }
      }

      campaign.sentTo = validLeads.map((l) => l._id);
    }

    // Update fields only if provided
    if (title) campaign.title = title;
    if (subject) campaign.subject = subject;
    if (description) campaign.description = description;
    if (type) campaign.type = type;
    if (category) campaign.category = category;
    if (status) campaign.status = status; // only allow updating status if needed

    await campaign.save();

    return res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data: campaign,
    });
  } catch (error) {
    console.error("Update Campaign Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: "sentTo",
        select: "name email phoneNumber isEmailOpened",
      })
      .populate({
        path: "createdBy",
        select: "name",
      });

    const formattedCampaigns = campaigns.map((campaign) => {
      const leads = campaign.sentTo || [];

      const totalLeads = leads.length;

      return {
        _id: campaign._id,
        title: campaign.title,
        description: campaign.description,
        type: campaign.type,
        subject: campaign.subject,
        category: campaign.category,
        status: campaign.status,
        createdBy: campaign.createdBy?.name,
        totalLeads,
        // openRate: openRate.toFixed(2) + "%",
        createdAt: campaign.createdAt,
        leads: leads.map((lead) => ({
          _id: lead._id,
          name: lead.name,
          email: lead.email,
          phoneNumber: lead.phoneNumber,
        })),
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedCampaigns,
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID",
      });
    }

    const campaign = await Campaign.findById(id)
      .populate("sentTo")
      .populate({ path: "createdBy", select: "name" });
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    const leads = campaign.sentTo;
    const totalSent = leads.length;

    return res.status(200).json({
      success: true,
      message: "Campaign details fetched successfully",
      data: {
        _id: campaign._id,
        title: campaign.title,
        description: campaign.description,
        type: campaign.type,
        subject: campaign.subject,
        catagory: campaign.category,
        status: campaign.status,
        createdBy: campaign.createdBy?.name,
        createdAt: campaign.createdAt,
        totalLeadsSent: totalSent,
        leads: leads.map((lead) => ({
          _id: lead._id,
          name: lead.name,
          email: lead.email,
          phoneNumber: lead.phoneNumber,
          isEmailOpened: lead.isEmailOpened || false,
          emailOpenedAt: lead.emailOpenedAt || null,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID",
      });
    }

    const campaign = await Campaign.findByIdAndDelete(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export {
  createCampaign,
  sendCampaign,
  getAllCampaigns,
  getCampaignById,
  deleteCampaign,
  updateCampaign,
};
