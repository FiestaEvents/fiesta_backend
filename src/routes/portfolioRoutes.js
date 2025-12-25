import express from "express";
import {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject
} from "../controllers/portfolioController.js";

import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js"; // Ensure this matches your filename
import validateRequest from "../middleware/validateRequest.js";
import { body } from "express-validator";

const router = express.Router();

router.use(authenticate);

const projectValidator = [
  body('title').notEmpty().withMessage('Title is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('items').optional().isArray().withMessage('Items must be an array')
];

router.route('/')
  .get(checkPermission('portfolio.read.all'), getProjects)
  .post(
    checkPermission('portfolio.create'), 
    projectValidator, 
    validateRequest, 
    createProject
  );

router.route('/:id')
  .get(checkPermission('portfolio.read.all'), getProject)
  .put(checkPermission('portfolio.update.all'), updateProject)
  .delete(checkPermission('portfolio.delete.all'), deleteProject);

export default router;