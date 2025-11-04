import express from "express";
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addComment,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  addAttachment,
  deleteAttachment,
  getTaskStats,
  getTaskBoard,
  getMyTasks,
} from "../controllers/taskController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { param, body } from "express-validator";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

router.use(authenticate);

// Special routes
router.get("/stats", checkPermission("tasks.read.all"), getTaskStats);
router.get("/board", getTaskBoard);
router.get("/my", getMyTasks);

// Comments
router.post(
  "/:id/comments",
  param("id").isMongoId(),
  body("text").notEmpty().withMessage("Comment text is required"),
  validateRequest,
  addComment
);

// Subtasks
router.post(
  "/:id/subtasks",
  param("id").isMongoId(),
  body("title").notEmpty().withMessage("Subtask title is required"),
  validateRequest,
  addSubtask
);

router.put(
  "/:id/subtasks/:subtaskId",
  param("id").isMongoId(),
  param("subtaskId").isMongoId(),
  validateRequest,
  toggleSubtask
);

router.delete(
  "/:id/subtasks/:subtaskId",
  param("id").isMongoId(),
  param("subtaskId").isMongoId(),
  validateRequest,
  deleteSubtask
);

// Attachments
router.post(
  "/:id/attachments",
  param("id").isMongoId(),
  body("fileName").notEmpty().withMessage("File name is required"),
  body("fileUrl").notEmpty().withMessage("File URL is required"),
  validateRequest,
  addAttachment
);

router.delete(
  "/:id/attachments/:attachmentId",
  param("id").isMongoId(),
  param("attachmentId").isMongoId(),
  validateRequest,
  deleteAttachment
);

// CRUD operations
router
  .route("/")
  .get(checkPermission("tasks.read.all"), getTasks)
  .post(checkPermission("tasks.create"), createTask);

router
  .route("/:id")
  .get(
    checkPermission("tasks.read.all"),
    param("id").isMongoId(),
    validateRequest,
    getTask
  )
  .put(
    checkPermission("tasks.update.all"),
    param("id").isMongoId(),
    validateRequest,
    updateTask
  )
  .delete(
    checkPermission("tasks.delete.all"),
    param("id").isMongoId(),
    validateRequest,
    deleteTask
  );

export default router;
