import express from 'express';
import checkAuth from '../middlewares/checkAuth.middleware.js';
import authorizeRoles from '../middlewares/authorizeRoles.middleware.js';   
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';

const Categoryrouter = express.Router();

Categoryrouter.post('/create',checkAuth ,authorizeRoles("manager"), createCategory);        // Create
Categoryrouter.get('/',checkAuth , getAllCategories);            // Read all
Categoryrouter.get("/getcategory/:id",checkAuth ,authorizeRoles("manager"), getCategoryById);          // Read one
Categoryrouter.put('/updatecategory/:id',checkAuth ,authorizeRoles("manager"), updateCategory);           // Update
Categoryrouter.delete('/deletecategory/:id',checkAuth ,authorizeRoles("manager"), deleteCategory);        // Delete

export default Categoryrouter;
