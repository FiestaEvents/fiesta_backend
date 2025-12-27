// scripts/force-sync-data.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Event, Client, Business } from "../src/models/index.js"; 

dotenv.config();

const forceSync = async () => {
  try {
    console.log("🔌 Connecting to DB...");
    await mongoose.connect(process.env.MONGODB_URI);

    // 1. Find your specific user (CHANGE THIS EMAIL if necessary)
    const email = "ahmed@test.com"; 
    
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`❌ User with email ${email} not found.`);
      process.exit(1);
    }

    if (!user.businessId) {
      console.log("❌ User has no businessId linked. Run the user fix script first.");
      process.exit(1);
    }

    const businessId = user.businessId;
    console.log(`👤 User Found: ${user.name}`);
    console.log(`🎯 Target Business ID: ${businessId}`);

    // 2. FORCE UPDATE: Move ALL events to this business
    // (⚠️ Warning: This takes ownership of EVERYTHING in the DB. Safe for local dev.)
    const eventResult = await Event.updateMany(
      {}, // No filter = Apply to ALL events
      { $set: { businessId: businessId } }
    );
    console.log(`✅ Moved ${eventResult.modifiedCount} events to your business.`);

    // 3. FORCE UPDATE: Move ALL clients
    const clientResult = await Client.updateMany(
      {},
      { $set: { businessId: businessId } }
    );
    console.log(`✅ Moved ${clientResult.modifiedCount} clients to your business.`);

    // 4. Ensure the Business is Active
    await Business.findByIdAndUpdate(businessId, {
        $set: { isActive: true }
    });

    console.log("🎉 Data sync complete.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

forceSync();