import mongoose from "mongoose";

const supplyCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    
    nameAr: {
      type: String,
      trim: true,
      maxlength: [50, "Arabic name cannot exceed 50 characters"],
    },
    
    nameFr: {
      type: String,
      trim: true,
      maxlength: [50, "French name cannot exceed 50 characters"],
    },
    
    description: {
      type: String,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    
    icon: {
      type: String,
      default: "Package", // Lucide icon name
    },
    
    color: {
      type: String,
      default: "#F18237", // Hex color for UI
    },
    
    // Display order in UI
    order: {
      type: Number,
      default: 0,
    },
    
    // Whether this is a default system category
    isDefault: {
      type: Boolean,
      default: false,
    },
    
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    
    isArchived: {
      type: Boolean,
      default: false,
    },
    
    archivedAt: Date,
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique category name per business
supplyCategorySchema.index({ businessId: 1, name: 1 }, { unique: true });

// ======================================================
// STATIC: Initialize Default Categories for New Business
// ======================================================
supplyCategorySchema.statics.initializeDefaults = async function (businessId, userId) {
  // NOTE: In future phases, you can filter this list based on business.category
  // e.g., if (business.category === 'driver') use different defaults.
  
  const defaultCategories = [
    {
      name: "Beverages",
      nameAr: "المشروبات",
      nameFr: "Boissons",
      description: "Juices, water, soft drinks",
      icon: "Coffee",
      color: "#3B82F6",
      order: 1,
      isDefault: true,
    },
    {
      name: "Snacks",
      nameAr: "الوجبات الخفيفة",
      nameFr: "Collations",
      description: "Cookies, chips, nuts",
      icon: "Cookie",
      color: "#F59E0B",
      order: 2,
      isDefault: true,
    },
    {
      name: "Food",
      nameAr: "الطعام",
      nameFr: "Nourriture",
      description: "Wedding snacks, canapés, ingredients",
      icon: "UtensilsCrossed",
      color: "#EF4444",
      order: 3,
      isDefault: true,
    },
    {
      name: "Decoration",
      nameAr: "الديكور",
      nameFr: "Décoration",
      description: "Flowers, balloons, centerpieces",
      icon: "Sparkles",
      color: "#EC4899",
      order: 4,
      isDefault: true,
    },
    {
      name: "Tableware",
      nameAr: "أدوات المائدة",
      nameFr: "Vaisselle",
      description: "Plates, cups, napkins",
      icon: "Utensils",
      color: "#8B5CF6",
      order: 5,
      isDefault: true,
    },
    {
      name: "Linen",
      nameAr: "المفروشات",
      nameFr: "Linge",
      description: "Tablecloths, chair covers",
      icon: "Shirt",
      color: "#06B6D4",
      order: 6,
      isDefault: true,
    },
    {
      name: "Equipment",
      nameAr: "المعدات",
      nameFr: "Équipement",
      description: "Chairs, tables, audio equipment, cameras",
      icon: "Wrench",
      color: "#10B981",
      order: 7,
      isDefault: true,
    },
    {
      name: "Cleaning",
      nameAr: "التنظيف",
      nameFr: "Nettoyage",
      description: "Cleaning supplies",
      icon: "Sparkles",
      color: "#6B7280",
      order: 8,
      isDefault: true,
    },
    {
      name: "Other",
      nameAr: "أخرى",
      nameFr: "Autre",
      description: "Miscellaneous items",
      icon: "Package",
      color: "#9CA3AF",
      order: 99,
      isDefault: true,
    },
  ];

  const categories = await Promise.all(
    defaultCategories.map((cat) =>
      this.create({
        ...cat,
        businessId: businessId,
        createdBy: userId,
      })
    )
  );

  return categories;
};

// ======================================================
// QUERY HELPERS
// ======================================================
supplyCategorySchema.query.active = function () {
  return this.where({ status: "active", isArchived: false });
};

supplyCategorySchema.query.byBusiness = function (businessId) {
  return this.where({ businessId });
};

// ======================================================
// PRE-DELETE: Prevent deletion if supplies exist
// ======================================================
supplyCategorySchema.pre("deleteOne", { document: true }, async function (next) {
  // Use mongoose.model to avoid circular dependency import issues
  const Supply = mongoose.model("Supply");
  const count = await Supply.countDocuments({ 
    categoryId: this._id,
    isArchived: false 
  });

  if (count > 0) {
    return next(
      new Error(
        `Cannot delete category. ${count} supplies are using this category. Please reassign or archive supplies first.`
      )
    );
  }

  next();
});

export default mongoose.model("SupplyCategory", supplyCategorySchema);