import mongoose from "mongoose";
import dotenv from "dotenv";
// Ensure this path matches your structure. 
// If Role.js is in src/models/Role.js, this import is correct.
import Role from "./src/models/Role.js"; 

// ✅ FIX: Load .env from the current directory (root)
dotenv.config(); 

const fix = async () => {
  try {
    const dbUri = process.env.MONGODB_URI;
    
    if (!dbUri) {
      throw new Error("❌ MONGODB_URI is undefined. Check your .env file location.");
    }

    console.log("🔌 Connecting to DB:", dbUri);
    await mongoose.connect(dbUri);
    console.log("✅ Connected.");

    // 1. Update all roles to ensure isArchived is false if missing
    const result = await Role.updateMany(
      { isArchived: { $exists: false } },
      { $set: { isArchived: false, isActive: true } }
    );

    console.log(`🛠️  Fixed ${result.modifiedCount} roles with missing fields.`);
    
    // 2. Log all roles to verify
    const roles = await Role.find({});
    console.log(`📊 Total Roles in DB: ${roles.length}`);
    
    if (roles.length > 0) {
      roles.forEach(r => console.log(` - Role: "${r.name}" | Venue: ${r.venueId}`));
    } else {
      console.log("⚠️ No roles found. You might need to run 'npm run seed'");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("👋 Done.");
    }
  }
};

fix();