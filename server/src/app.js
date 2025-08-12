import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "10mb",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);
app.use(express.static("public"));
app.use(cookieParser());

// Import Routes and State it's Functions in Try Catch Block
import userRouter from "./routes/user.routes.js";
try {
  app.use("/api/v1/user", userRouter);
} catch (error) {
  console.log("File: app.js", "Line 33:", error);
  throw new Error("Error Occured in Routes", error);
}

import workerRouter from "./routes/worker.routes.js";
try {
  app.use("/api/v1/worker", workerRouter);
} catch (error) {
  console.log("File: app.js", "Line 41:", error);
  throw new Error("Error Occured in worker Routes", error);
}
// Import Manager Routes and State it's Functions in Try Catch Block
import managerRouter from "./routes/manager.routes.js";
try {
  app.use("/api/v1/manager", managerRouter);
} catch (error) {
  console.log("File: app.js", "Line 49:", error);
  throw new Error("Error occurred in manager routes", { cause: error });
}
// Import manager Seed Routes and State it's Functions in Try Catch Block
import seedRoutes from "./routes/manager.seed.routes.js";
try {
  app.use("/api/v1/seed", seedRoutes);
} catch (error) {
  console.log("File: app.js", "Line 57:", error);
  throw new Error("Error occurred in seed routes", { cause: error });
}
import leadRouter from "./routes/lead.routes.js";
try {
  app.use("/api/v1/lead", leadRouter);
} catch (error) {
  console.log("File: app.js", "Line 64:", error);
  throw new Error("Error occurred in lead routes", { cause: error });
}
import categoryRouter from "./routes/category.routes.js";
try {
  app.use("/api/v1/category", categoryRouter);
} catch (error) {
  console.log("File: app.js", "Line 71:", error);
  throw new Error("Error occurred in catagory routes", { cause: error });
}

import conversationRouter from "./routes/conversation.routes.js";
try {
  app.use("/api/v1/conversation", conversationRouter);
} catch (error) {
  console.log("File: app.js", "Line 79:", error);
  throw new Error("Error occurred in conversation routes", { cause: error });
}

import notificationRouter from "./routes/notification.routes.js";
try {
  app.use("/api/v1/notification", notificationRouter);
} catch (error) {
  console.log("File: app.js", "Line 87:", error);
  throw new Error("Error occurred in notification routes", { cause: error });
}

import campaignrouter from "./routes/campaign.routes.js";
try {
  app.use("/api/v1/campaign", campaignrouter);
} catch (error) {
  console.log("File: app.js", "Line 95:", error);
  throw new Error("Error occurred in conversation routes", { cause: error });
}

import currentUserRouter from "./routes/current.routers.js";
try {
  app.use("/api/v1/user", currentUserRouter);
} catch (error) {
  console.log("File: app.js", "Line 95:", error);
  throw new Error("Error occurred in conversation routes", { cause: error });
}

export default app;
