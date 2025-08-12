import { Worker } from "../models/worker.models.js";
import generateOtp from "../utils/generateOtp.js";
import { generateEncryptedKey, generateRoleToken } from "../utils/RoleToken.js";
import sendEmail from "../utils/mailer.js";
import Conversation from "../models/conversation.model.js";
import Lead from "../models/lead.model.js";
import mongoose from "mongoose";

const registerWorker = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          message: "All fields are required",
        },
      });
    }
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "password must be at least 6 characters",
      });
    }

    const workerExists = await Worker.findOne({ email });
    if (workerExists) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Worker already exits",
        },
      });
    }

    const createdUser = await Worker.create({
      name,
      email,
      password,
    });

    const token = createdUser.generateAccessToken();

    return res
      .status(201)
      .cookie("token", token)
      .json({
        success: true,
        response: {
          message: "Worker created successfully!",
        },
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};

const loginWorker = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          message: "All fields are required",
        },
      });
    }

    const user = await Worker.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: "No worker exists",
        },
      });
    }

    const isPasswordMatched = await user.isPasswordCorrect(password);
    if (!isPasswordMatched) {
      return res.status(401).json({
        success: false,
        error: {
          message: "Invalid Password",
        },
      });
    }

    const token = user.generateAccessToken();

    // Generate a JWT token containing the user's role
    const roleToken = generateRoleToken("worker", process.env.WRK_SUFFIX);

    // Generate a randomized cookie key (prefixed with '001') for storing the role token
    const key = generateEncryptedKey(process.env.WRK_KEY_NAME); // '001'

    const cookiesOption = {
      sameSite: "strict",
      httpOnly: false,
      secure: process.env.NODE_ENV === "development" ? false : true,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain:
        process.env.NODE_ENV === "development" ? "localhost" : ".indibus.net",
    };

    return res
      .status(200)
      .cookie("token", token, cookiesOption)
      .cookie(key, roleToken, cookiesOption)
      .json({
        success: true,
        response: {
          message: "Worker Logged in successfully!",
        },
        data: null,
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server error",
      },
    });
  }
};
const getWorkers = async (req, res) => {
  try {
    const workers = await Worker.find().select("-password");
    if (workers.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: "No workers found",
        },
      });
    }
    return res.status(200).json({
      success: true,
      response: {
        message: "Workers fetched successfully",
      },
      data: workers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal Server Error",
      },
    });
  }
};

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const worker = await Worker.findOne({ email });
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    // generate 6 digit otp
    const otp = generateOtp();
    const expiry = Date.now() + 10 * 60 * 1000;

    worker.otp = otp;
    // set expiry time to 10 minutes from now
    worker.otpExpiry = expiry;
    await worker.save();

    // Create a link for password reset
    // Ensure CLIENT_URL is defined in your environment variables
    const linkUrl = `${process.env.CLIENT_URL}/worker/auth/reset-password/${worker._id}`;

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
      },
      data: {
        workerId: worker._id,
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

const verifyOtp = async (req, res) => {
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

    const userId = req.params.id;
    const user = await Worker.findById(userId);

    if (!user || !user.otp || !user.otpExpiry) {
      return res.status(400).json({
        success: false,
        error: {
          message: "OTP not found or expired",
        },
      });
    }

    if (user.otp !== otp || user.otpExpiry < Date.now()) {
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
      data: null,
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

const resetPassword = async (req, res) => {
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
      return res.status(400).json({
        //  <-- return was missing here
        success: false,
        message: "password must be at least 6 characters",
      });
    }

    const userId = req.params.id;
    const user = await Worker.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: "User not found",
        },
      });
    }

    const isSamePassword = await user.isPasswordCorrect(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: {
          message: "New password cannot be the same as the old password",
        },
      });
    }

    user.password = newPassword;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

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

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Sunday

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const dateFilter =
      startDate && endDate ? { createdAt: { $gte: start, $lte: end } } : {};

    const baseFilter = {
      assignedTo: userId,
      isDeleted: false,
      ...dateFilter,
    };

    // 1. Total Assigned Leads
    const totalAssignedLeads = await Lead.countDocuments(baseFilter);

    // 2. Pending Follow-ups
    const pendingFollowUps = await Lead.countDocuments({
      ...baseFilter,
      followUpDates: { $elemMatch: { $gt: today.toISOString() } },
    });
    console.log("Pending Follow-ups:", pendingFollowUps);

    // 3. Follow-ups Today
    const followUpsTodayData = await Lead.find({
      ...baseFilter,
      followUpDates: {
        $elemMatch: { $gte: today.toISOString(), $lt: tomorrow.toISOString() },
      },
    })
      .select("name followUpDates")
      .lean();
    const followUpsTodayCount = followUpsTodayData.length;

    // 4. Missing Follow-ups (past follow-up dates without conversation)
    const missingFollowUps = await Lead.countDocuments({
      ...baseFilter,
      followUpDates: { $elemMatch: { $lt: today.toISOString() } },
      conversations: { $not: { $elemMatch: { date: { $gte: today } } } },
    });

    // 5. Performance by Category (profitable / non-profitable per category)
    const categoryPerformance = await Lead.aggregate([
      {
        $match: {
          assignedTo: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "conversations",
          localField: "_id",
          foreignField: "lead",
          as: "conversations",
        },
      },
      {
        $addFields: {
          hasConversations: { $gt: [{ $size: "$conversations" }, 0] },
          isLeadProfitable: {
            $cond: {
              if: {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: "$conversations",
                        as: "conv",
                        cond: { $eq: ["$$conv.isProfitable", true] },
                      },
                    },
                  },
                  0,
                ],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $match: {
          hasConversations: true,
        },
      },
      {
        $group: {
          _id: "$category",
          totalLeads: { $sum: 1 },
          profitable: {
            $sum: {
              $cond: [{ $eq: ["$isLeadProfitable", true] }, 1, 0],
            },
          },
          nonprofitable: {
            $sum: {
              $cond: [{ $eq: ["$isLeadProfitable", false] }, 1, 0],
            },
          },
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
        $unwind: "$categoryInfo",
      },
      {
        $project: {
          _id: 0,
          categoryId: "$_id",
          categoryName: "$categoryInfo.title",
          totalLeads: 1,
          profitable: 1,
          nonprofitable: 1,
        },
      },
    ]);

    // 6. Upcoming Schedule
    const upcomingSchedule = {
      today: followUpsTodayData.map((lead) => lead.name),
      tomorrow: (
        await Lead.find({
          ...baseFilter,
          followUpDates: {
            $elemMatch: {
              $gte: tomorrow.toISOString(),
              $lt: new Date(
                tomorrow.getTime() + 24 * 60 * 60 * 1000
              ).toISOString(),
            },
          },
        })
          .select("name")
          .lean()
      ).map((lead) => lead.name),
    };

    // 7. Overdue Follow-ups (past due follow-ups)
    const overdueFollowUps = await Lead.find({
      ...baseFilter,
      followUpDates: { $elemMatch: { $lt: today.toISOString() } },
    })
      .sort({ followUpDates: 1 })
      .lean();

    // 8. Recent Assignments
    const recentAssignments = await Lead.find({
      assignedTo: userId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 9. This Week’s Performance
    const thisWeekConvos = await Conversation.find({
      addedBy: userId,
      isDeleted: false,
      date: { $gte: thisWeekStart.toISOString(), $lte: today.toISOString() },
    }).lean();

    const lastWeekConvos = await Conversation.find({
      addedBy: userId,
      isDeleted: false,
      date: {
        $gte: lastWeekStart.toISOString(),
        $lt: thisWeekStart.toISOString(),
      },
    }).lean();

    const callsMade = thisWeekConvos.filter((c) =>
      c.conclusion.toLowerCase().includes("call")
    ).length;
    const meetingsScheduled = thisWeekConvos.filter((c) =>
      c.conclusion.toLowerCase().includes("meeting")
    ).length;
    const profitableThisWeek = thisWeekConvos.filter(
      (c) => c.isProfitable
    ).length;
    const totalThisWeek = thisWeekConvos.length;

    const conversionRate = totalThisWeek
      ? ((profitableThisWeek / totalThisWeek) * 100).toFixed(2)
      : "0.00";

    const improvementFromLastWeek =
      lastWeekConvos.length > 0
        ? (
            ((profitableThisWeek -
              lastWeekConvos.filter((c) => c.isProfitable).length) /
              lastWeekConvos.length) *
            100
          ).toFixed(2)
        : "100.00";

    //  Final response
    res.status(200).json({
      success: true,
      totalAssignedLeads,
      pendingFollowUps,
      followUpsToday: {
        count: followUpsTodayCount,
        data: followUpsTodayData,
      },
      missingFollowUps,
      performanceByCategory: categoryPerformance,
      upcomingSchedule,
      overdueFollowUps,
      recentAssignments,
      thisWeeksPerformance: {
        callsMade,
        meetingsScheduled,
        conversionRate,
        improvementFromLastWeek,
      },
    });
  } catch (error) {
    console.error("Error fetching worker dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export {
  registerWorker,
  loginWorker,
  sendOtp,
  verifyOtp,
  resetPassword,
  getWorkers,
  getDashboardData,
};
