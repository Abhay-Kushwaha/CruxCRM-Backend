import mongoose from "mongoose";
import Category from "../models/categories.model.js";
import Lead from "../models/lead.model.js";

// Create a new category
const createCategory = async (req, res) => {
  try {
    const { title, description, color } = req.body;

    // if a category with the same title already exists (case-insensitive)
    const existingCategory = await Category.findOne({
      title: { $regex: new RegExp("^" + title + "$", "i") },
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this title already exists",
      });
    }

    const category = new Category({ title, description, color });
    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Failed to create category",
      });
    }
    await category.save();

    res.status(201).json({
      success: true,
      message: "category created successfully",
      data: category,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    if (!categories || categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No categories found",
      });
    }
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "internal server error",
    });
  }
};

// Get category by ID
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category)
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      error: "internal server error",
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category)
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: "internal server error",
      error: err.message,
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const isAssigned = await Lead.findOne({ category: categoryId });

    if (isAssigned) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be deleted as it is assigned to leads",
      });
    }

    if (!categoryId)
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }
    await Category.findByIdAndDelete(categoryId);
    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "internal server error",
      error: err.message,
    });
  }
};
const getLeadsByCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const leads = await Lead.find({ category: id });
    // .populate('category', 'title color');

    if (!leads || leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found for this category",
      });
    }

    return res.status(200).json({
      success: true,
      data: leads,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

export {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getLeadsByCategory,
};
