import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const fixSupplyIndex = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log("🧹 Checking SupplyCategory collection indexes...");
    const collection = db.collection("supplycategories"); // Note: Mongoose pluralizes & lowercases
    
    const indexes = await collection.indexes();
    const oldIndex = indexes.find(i => i.name === "venueId_1_name_1");

    if (oldIndex) {
      console.log("🗑️ Found conflicting index: 'venueId_1_name_1'. Dropping it...");
      await collection.dropIndex("venueId_1_name_1");
      console.log("✅ Index dropped.");
    } else {
      console.log("👍 No conflicting 'venueId' index found.");
    }

    // Optional: Clean up null fields
    await collection.updateMany({ venueId: null }, { $unset: { venueId: "" } });

    console.log("🎉 Done.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixSupplyIndex();