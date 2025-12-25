import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Business, Role } from "../src/models/index.js"; // Adjust path if needed

dotenv.config();

const fixUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🔌 Connected to DB");

    // 1. Find the broken user (Change email to yours)
    const email = "ahmed@test.com"; 
    const user = await User.findOne({ email });

    if (!user) {
      console.log("❌ User not found.");
      process.exit(1);
    }

    console.log(`👤 Found User: ${user.name} (ID: ${user._id})`);

    // 2. Find ANY business created by this user
    let business = await Business.findOne({ owner: user._id });

    // 3. If no business exists, create a dummy one
    if (!business) {
      console.log("⚠️ No business found for this user. Creating a default one...");
      business = await Business.create({
        name: `${user.name}'s Studio`,
        category: "photography",
        owner: user._id,
        contact: { email: user.email },
        subscription: { plan: "pro", status: "active" }
      });
    }

    console.log(`🏢 Linking to Business: ${business.name} (ID: ${business._id})`);

    // 4. Update User with businessId
    user.businessId = business._id;
    
    // 5. Ensure Role exists and is linked
    let role = await Role.findOne({ name: "Owner", businessId: business._id });
    if (!role) {
       console.log("🛡️ Creating Owner Role...");
       role = await Role.create({
         name: "Owner",
         businessId: business._id,
         isSystemRole: true,
         level: 100
       });
    }
    user.roleId = role._id;

    await user.save();
    console.log("✅ User successfully linked! Try logging in again.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

fixUser();