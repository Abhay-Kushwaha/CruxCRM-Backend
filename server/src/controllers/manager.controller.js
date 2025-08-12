import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateEncryptedKey, generateRoleToken } from "../utils/RoleToken.js";
import sendEmail from "../utils/mailer.js";
import generateOtp from "../utils/generateOtp.js";
import { Manager } from "../models/manager.model.js";
import { Worker } from "../models/worker.models.js";
import Lead from "../models/lead.model.js";
import { Campaign } from "../models/campaign.model.js";
import { Notification } from "../models/notification.model.js";
import Conversation from "../models/conversation.model.js";

const loginManager = async (req, res) => {
  const { email, password } = req.body;

  try {
    const manager = await Manager.findOne({ email });
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, manager.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = manager.generateAccessToken();

    // Generate a JWT token containing the manger's role
    const roleToken = generateRoleToken("manager", process.env.MAN_SUFFIX);

    // Generate a randomized cookie key (prefixed with '002') for storing the role token
    const key = generateEncryptedKey(process.env.MAN_KEY_NAME); // '002'

    const cookiesOption = {
      sameSite: "strict",
      httpOnly: false,
      secure: process.env.NODE_ENV === "development" ? false : true,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain:
        process.env.NODE_ENV === "development" ? "localhost" : ".indibus.net",
    };
    // Set cookies (can add httpOnly, secure, sameSite as needed)
    return res
      .status(200)
      .cookie("token", token, cookiesOption)
      .cookie(key, roleToken, cookiesOption)
      .json({
        success: true,
        message: "Login successful",
        token,
        manager: {
          id: manager._id,
          name: manager.name,
          email: manager.email,
          role: manager.role,
          createdAt: manager.createdAt,
        },
      });
  } catch (error) {
    console.error("Error in loginManager:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const manager = await Manager.findOne({ email });
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "manager not found",
      });
    }

    // generate 6 digit otp
    const otp = generateOtp();
    const expiry = Date.now() + 10 * 60 * 1000;

    manager.otp = otp;
    // set expiry time to 10 minutes from now
    manager.otpExpiry = expiry;
    await manager.save();

    const linkUrl = `${process.env.CLIENT_URL}/reset-password/${manager._id}`;

    // Email content
    // Use a template literal to create the HTML content
    // HTML email content
    const html = `
      <p>Your OTP is <strong>${otp}</strong>. It is valid for 10 minutes.</p>
      <p>You can also reset your password directly using the link below:</p>
      <a href="${linkUrl}" style="display:inline-block;padding:10px 20px;background-color:#007BFF;color:#fff;text-decoration:none;border-radius:5px;">Reset Password</a>
    `;

    // Send the email using the sendEmail utility
    await sendEmail({ to: email, subject: "Password Reset OTP", html });
    res.status(200).json({
      success: true,
      response: {
        message: "OTP sent successfully",
        //otp: otp,                    // Optional: Include OTP in response for testing purposes
      },
      data: {
        managerId: manager._id,
        RedirectUrl: linkUrl,
      },
    });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({
      success: false,
      error: {
        message: "Internal Server Error",
      },
    });
  }
};

// Verify OTP function
const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({
        success: false,
        error: {
          message: "OTP is required",
        },
      });
    }

    const managerId = req.params.id;
    const manager = await Manager.findById(managerId);

    if (!manager || !manager.otp || !manager.otpExpiry) {
      return res.status(400).json({
        success: false,
        error: {
          message: "OTP not found or expired",
        },
      });
    }

    if (manager.otp !== otp || manager.otpExpiry < Date.now()) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid or expired OTP",
        },
      });
    }

    res.status(200).json({
      success: true,
      response: {
        message: "OTP verified successfully",
      },
      data: {
        managerId: manager._id,
      },
    });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    res.status(500).json({
      success: false,
      error: {
        message: "Internal Server Error",
      },
    });
  }
};

// RRESET PASSWORD function
const resetPASS = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          message: "New password is required",
        },
      });
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: "password must be at least 6 characters",
      });
    }

    const managerId = req.params.id;
    const foundManager = await Manager.findById(managerId).select("+password");

    if (!foundManager) {
      return res.status(404).json({
        success: false,
        error: {
          message: "manager not found",
        },
      });
    }

    const isSamePassword = await foundManager.isPasswordCorrect(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: {
          message: "New password cannot be the same as the old password",
        },
      });
    }

    foundManager.password = newPassword;
    foundManager.otp = null;
    foundManager.otpExpiry = null;
    await foundManager.save();

    res.status(200).json({
      success: true,
      response: {
        message: "Password reset successfully",
      },
    });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({
      success: false,
      error: {
        message: "Internal Server Error",
      },
    });
  }
};

const getDashboardData = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const userId = req.user._id;
    const isManager = req.user.role === "manager";
    const filter = isManager ? {} : { assignedTo: userId };
    // date fiter
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Set end date to end of the day
    const dateFilter =
      startDate && endDate ? { createdAt: { $gte: start, $lte: end } } : {};
    // Total leads
    const totalLeads = await Lead.countDocuments({
      ...filter,
      isDeleted: false,
      ...dateFilter, // datefilter
    });

    // Engaged leads (
    const engagedLeads = await Lead.countDocuments({
      ...filter,
      isDeleted: false,
      ...dateFilter, // date filter
      conversations: { $exists: true, $not: { $size: 0 } },
    });

    // Conversation rate
    const conversationRate = totalLeads
      ? ((engagedLeads / totalLeads) * 100).toFixed(2)
      : 0;

    // Overdue follow-ups
    const today = new Date();
    const overdueTasks = await Lead.countDocuments({
      ...filter,
      isDeleted: false,
      followUpDates: { $elemMatch: { $lt: today.toISOString() } },
    });

    // Leads in last 7 days
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const recentLeads = await Lead.find({
      ...filter,
      isDeleted: false,
      createdAt: { $gte: last7Days },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const recentLeadsCount = recentLeads.length;

    // Recent notifications
    const recipientType = req.user.role;

    const recentNotifications = await Notification.find({
      sentTo: req.user._id,
      recipientType: recipientType,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Leads by category for pie chart
    const leadsByCategory = await Lead.aggregate([
      {
        $match: {
          ...filter,
          isDeleted: false,
          ...dateFilter, // date filter
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      {
        $unwind: "$categoryInfo", // Flatten the array to access fields directly
      },
      {
        $project: {
          _id: 0,
          category: "$categoryInfo.title",
          count: 1,
        },
      },
    ]);

    // console.log("Leads by Category:", leadsByCategory);

    // Campaign performance
    const campaignPerformance = await Campaign.aggregate([
      {
        $match: {
          ...(isManager && { createdBy: userId }), // filter by manager if needed
          ...dateFilter,
        },
      },
      {
        $lookup: {
          from: "leads",
          localField: "sentTo",
          foreignField: "_id",
          as: "leads",
        },
      },
      {
        $addFields: {
          targetLeads: { $size: "$leads" },
          convertedLeads: {
            $size: {
              $filter: {
                input: "$leads",
                as: "lead",
                cond: { $gt: [{ $size: "$$lead.conversations" }, 0] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          conversionRate: {
            $cond: [
              { $eq: ["$targetLeads", 0] },
              0,
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$convertedLeads", "$targetLeads"] },
                      100,
                    ],
                  },
                  2,
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          title: 1,
          targetLeads: 1,
          convertedLeads: 1,
          conversionRate: 1,
        },
      },
    ]);

    // Upcoming deadlines
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    const upcomingDeadlines = await Lead.find({
      ...filter,
      isDeleted: false,
      followUpDates: {
        $elemMatch: {
          $gte: today.toISOString(),
          $lte: next7Days.toISOString(),
        },
      },
    })
      .sort({ followUpDates: 1 })
      .limit(10)
      .lean();

    // Get All Workers with their performance
    const workers = await Worker.find().select("_id name").lean();

    const leaderboardData = await Promise.all(
      workers.map(async (worker) => {
        const totalAssignedLeads = await Lead.countDocuments({
          assignedTo: worker._id,
          isDeleted: false,
          ...dateFilter,
        });

        const profitableConversations = await Conversation.countDocuments({
          addedBy: worker._id,
          isDeleted: false,
          isProfitable: true,
          ...dateFilter,
        });

        const convertedPercentage = totalAssignedLeads
          ? ((profitableConversations / totalAssignedLeads) * 100).toFixed(2)
          : 0;

        return {
          workerId: worker._id,
          name: worker.name,
          totalAssignedLeads,
          profitableConversations,
          convertedPercentage: parseFloat(convertedPercentage),
        };
      })
    );

    // Sort by converted percentage descending
    const sortedLeaderboard = leaderboardData.sort(
      (a, b) => b.convertedPercentage - a.convertedPercentage
    );

    // -----------------------
    // BUSINESS INSIGHTS START
    // -----------------------

    // Lead Velocity Rate
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    const weekBeforeLast = new Date();
    weekBeforeLast.setDate(today.getDate() - 14);

    const leadsLast7Days = await Lead.countDocuments({
      ...filter,
      isDeleted: false,
      ...dateFilter, // date fikter
      createdAt: { $gte: lastWeek },
    });

    const leadsPrev7Days = await Lead.countDocuments({
      ...filter,
      isDeleted: false,
      createdAt: { $gte: weekBeforeLast, $lt: lastWeek },
    });

    const leadVelocityRate = leadsPrev7Days
      ? (((leadsLast7Days - leadsPrev7Days) / leadsPrev7Days) * 100).toFixed(2)
      : leadsLast7Days > 0
      ? "100.00"
      : "0.00";

    // Average Lead Response Time
    const responseTimes = await Lead.aggregate([
      {
        $match: {
          ...filter,
          isDeleted: false,
          ...dateFilter, // date filter
          lastContact: { $exists: true },
        },
      },
      {
        $project: {
          responseTimeInHours: {
            $divide: [
              { $subtract: ["$lastContact", "$createdAt"] },
              1000 * 60 * 60,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: "$responseTimeInHours" },
        },
      },
    ]);

    const averageLeadResponseTime =
      responseTimes[0]?.avgResponseTime?.toFixed(2) || "0";

    // Top Converting Campaign
    const campaigns = await Campaign.find({ delivered: { $gt: 0 } })
      .select("title delivered opened")
      .lean();

    const campaignPerfo = campaigns.map((camp) => {
      const openRate = ((camp.opened / camp.delivered) * 100).toFixed(2);
      return {
        title: camp.title,
        delivered: camp.delivered,
        opened: camp.opened,
        openRate: parseFloat(openRate),
      };
    });

    const topConvertingCampaign = campaignPerfo.length
      ? campaignPerfo.reduce((prev, curr) =>
          curr.openRate > prev.openRate ? curr : prev
        )
      : { title: "N/A", openRate: 0 };

    // Most Engaged Worker
    const mostEngagedWorker = sortedLeaderboard.length
      ? sortedLeaderboard[0]
      : null;

    // Top Lead Source
    const topLeadSourceData = await Lead.aggregate([
      {
        $match: {
          ...filter,
          isDeleted: false,
          ...dateFilter,
          leadSource: { $exists: true, $ne: "" },
        },
      },
      { $group: { _id: "$leadSource", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    const topLeadSource = topLeadSourceData[0]?._id || "N/A";

    // Average Sales Cycle Duration
    const salesCycleDurations = await Lead.aggregate([
      {
        $match: {
          ...filter,
          isDeleted: false,
          lastContact: { $exists: true },
          ...dateFilter, // date filter
        },
      },
      {
        $project: {
          cycleDurationInDays: {
            $divide: [
              { $subtract: ["$lastContact", "$createdAt"] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgCycleDuration: { $avg: "$cycleDurationInDays" },
        },
      },
    ]);

    const averageSalesCycleDuration =
      salesCycleDurations[0]?.avgCycleDuration?.toFixed(2) || "0";

    // Highest Performing Category
    const highestPerformingCategory = leadsByCategory.length
      ? leadsByCategory.reduce((prev, curr) =>
          curr.count > prev.count ? curr : prev
        )
      : null;

    // ---------------------
    // BUSINESS INSIGHTS END
    // ---------------------

    // lead pipeline
    const pipelineStatuses = ["new", "in-progress", "follow-up", "closed"];

    const leadPipelineCounts = await Lead.aggregate([
      {
        $match: {
          ...filter,
          isDeleted: false,
          ...dateFilter,
          status: { $in: pipelineStatuses },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Map the result to always include all statuses with 0 fallback
    const leadPipeline = pipelineStatuses.map((status) => {
      const found = leadPipelineCounts.find((item) => item._id === status);
      return { status, count: found ? found.count : 0 };
    });

    // Leads generated per day for the past 7 days
    const generateLast7DaysRange = (endDate) => {
      const result = [];

      const end = new Date(endDate || new Date());
      end.setUTCDate(end.getUTCDate() - 1);
      // Normalize to 00:00:00 UTC
      end.setUTCHours(0, 0, 0, 0);

      const start = new Date(end);
      start.setUTCDate(end.getUTCDate() - 6);

      for (
        let d = new Date(start);
        d <= end;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const from = new Date(d);
        const to = new Date(d);
        to.setUTCDate(to.getUTCDate() + 1);

        result.push({
          from,
          to,
          formatted: from.toISOString().split("T")[0], // YYYY-MM-DD
        });
      }

      return result;
    };

    const dailyLeadsLast7Days = await Promise.all(
      generateLast7DaysRange(end).map(async ({ from, to, formatted }) => {
        const count = await Lead.countDocuments({
          ...filter,
          isDeleted: false,
          createdAt: {
            $gte: from,
            $lt: to,
          },
        });

        return {
          date: formatted,
          count,
        };
      })
    );

    // Leads by source count
    const leadsBySource = await Lead.aggregate([
      {
        $match: {
          ...filter,
          isDeleted: false,
          ...dateFilter,
          leadSource: { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$leadSource",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          source: "$_id",
          count: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      totalLeads,
      engagedLeads,
      conversationRate,
      overdueTasks,
      recentLeadsCount,
      recentLeads,
      recentNotifications,
      leadsByCategory,
      campaignPerformance,
      upcomingDeadlines,
      teamLeaderboard: sortedLeaderboard,
      businessInsights: {
        leadVelocityRate,
        averageLeadResponseTime,
        topConvertingCampaign,
        mostEngagedWorker,
        topLeadSource,
        averageSalesCycleDuration,
        highestPerformingCategory,
      },
      leadPipeline,
      dailyLeadsLast7Days,
      leadsBySource,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard data",
    });
  }
};
export { loginManager, sendOTP, verifyOTP, resetPASS, getDashboardData };
