import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const FIX_TARGETS = [
  { collection: "invoicesettings", index: "venue_1" },
  { collection: "contractsettings", index: "venue_1" },
  { collection: "supplycategories", index: "venueId_1_name_1" },
  { collection: "roles", index: "name_1_venueId_1" },
  { collection: "users", index: "name_1" }, // Remove unique name constraint
  { collection: "invoices", index: "invoiceNumber_1" } // Remove global invoice uniqueness
];

const runFix = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    console.log("✅ Connected.");

    console.log("\n🧹 Starting Index Cleanup...");

    for (const target of FIX_TARGETS) {
      try {
        const collection = db.collection(target.collection);
        const exists = await collection.indexExists(target.index);
        
        if (exists) {
          console.log(`   🔥 Dropping index '${target.index}' from '${target.collection}'...`);
          await collection.dropIndex(target.index);
          console.log(`      ✅ Dropped.`);
          
          // Optional: Clean up null fields that caused the issue
          const fieldName = target.index.includes("venueId") ? "venueId" : "venue";
          if (fieldName !== "name" && fieldName !== "invoiceNumber") {
             await collection.updateMany({ [fieldName]: null }, { $unset: { [fieldName]: "" } });
             console.log(`      ✨ Cleaned up null '${fieldName}' fields.`);
          }
        } else {
          console.log(`   ok: '${target.collection}' is clean.`);
        }
      } catch (error) {
        // Ignore "ns not found" errors (collection doesn't exist yet)
        if (error.code !== 26) {
          console.error(`   ❌ Error on ${target.collection}:`, error.message);
        }
      }
    }

    console.log("\n🎉 All legacy indexes cleaned.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Critical Error:", error);
    process.exit(1);
  }
};

runFix();