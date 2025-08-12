import express from "express";
import {
  getAllConversations,
  getConversationsByWorker,
  getConversationsByLead,
  updateConversation,
  deleteConversation,
} from "../controllers/consversation.controller.js\
";
import checkAuth from "../middlewares/checkAuth.middleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.middleware.js";

const conversationRouter = express.Router();
// conversationRouter.post("/create/:leadId",  checkAuth,createConversation);
conversationRouter.get("/", checkAuth, getAllConversations);
conversationRouter.get("/:leadId", checkAuth, getConversationsByLead);
conversationRouter.get(
  "/worker/:workerId",
  checkAuth,
  getConversationsByWorker
);
conversationRouter.put("/update/:id", checkAuth, updateConversation);
conversationRouter.delete("/delete/:id", checkAuth, deleteConversation);

export default conversationRouter;
