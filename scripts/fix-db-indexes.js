import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const fixInvoiceIndex = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    console.log("🧹 Checking Invoice collection indexes...");
    const collection = db.collection("invoices");
    
    // 1. Get current indexes
    const indexes = await collection.indexes();
    const indexNames = indexes.map(i => i.name);
    console.log("Found indexes:", indexNames);

    // 2. Identify the specific problematic index
    // It is usually named "invoiceNumber_1"
    const oldIndexName = "invoiceNumber_1";

    if (indexNames.includes(oldIndexName)) {
      console.log(`🗑️ Found conflicting global index: '${oldIndexName}'. Dropping it...`);
      await collection.dropIndex(oldIndexName);
      console.log("✅ Successfully dropped the old index.");
      console.log("👉 Now, Business A and Business B can both have 'INV-25-0001'.");
    } else {
      console.log("👍 Old global index not found. You might be safe, or it has a different name.");
    }

    // 3. Verify/Create the new Compound Index (Optional, Mongoose usually handles this on boot)
    // We want uniqueness only per business
    // console.log("⚙️ Ensuring new compound index exists...");
    // await collection.createIndex({ business: 1, invoiceNumber: 1 }, { unique: true });

    console.log("🎉 Done.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixInvoiceIndex();