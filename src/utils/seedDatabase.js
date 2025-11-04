import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Make sure bcryptjs is used to hash the password
import { Permission, Role, Venue, User } from "../models/index.js";
import { PERMISSIONS } from "../config/permissions.js";
import { DEFAULT_ROLES } from "../config/roles.js";
import config from "../config/env.js";
import connectDB from "../config/database.js";

// Password and salt rounds for the initial demo user
const DEFAULT_OWNER_PASSWORD = "password123";
const SALT_ROUNDS = 10; 

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("🌱 Starting database seeding...\n");

    // 1. Clear existing data (MANDATORY RESET)
     await Permission.deleteMany({});
     await Role.deleteMany({});
     await Venue.deleteMany({});
     await User.deleteMany({});
     console.log("✅ Cleared existing permissions, roles, venues, and users\n");

    // 2. Seed Permissions
    console.log("📝 Seeding permissions...");
    
    const permissionPromises = PERMISSIONS.map(async (perm) => {
      // Use findOneAndUpdate with upsert for resilient seeding (create or update)
      return Permission.findOneAndUpdate(
        { name: perm.name },
        perm,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    });

    const createdPermissions = await Promise.all(permissionPromises);
    console.log(`✅ Created/Updated ${createdPermissions.length} permissions\n`);

    // Create permission lookup map for quick role assignment
    const permissionMap = {};
    createdPermissions.forEach((p) => {
      permissionMap[p.name] = p._id;
    });

    // 3. Get all venues
    const venues = await Venue.find({});
    console.log(`📍 Found ${venues.length} venue(s)`);

    if (venues.length === 0) {
      console.log("⚠️ No venues found. Creating a demo venue...");

      // Create demo venue
      const demoVenue = await Venue.create({
        name: "Fiesta Demo Venue",
        description: "A beautiful event venue for all occasions",
        address: {
          street: "123 Main Street",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA",
        },
        contact: {
          phone: "+1234567890",
          email: "demo@venue.com",
        },
        capacity: {
          min: 50,
          max: 500,
        },
        pricing: {
          basePrice: 5000,
        },
        subscription: {
          plan: "annual",
          status: "active",
          startDate: new Date(),
          amount: 1200,
        },
        // owner field will be updated in step 5
        owner: new mongoose.Types.ObjectId(), 
        timeZone: "America/New_York",
      });

      venues.push(demoVenue);
      console.log("✅ Created demo venue\n");
    }

    // 4. Seed Roles for each venue
    console.log("👥 Seeding roles...");

    for (const venue of venues) {
      for (const roleConfig of DEFAULT_ROLES) {
        // Determine which permissions to assign
        const permissionIds =
          roleConfig.permissions === "ALL"
            ? createdPermissions.map((p) => p._id)
            : roleConfig.permissions.map((permName) => permissionMap[permName]).filter(Boolean);

        // Find and update/create the role
        await Role.findOneAndUpdate(
          { name: roleConfig.name, venueId: venue._id },
          {
            ...roleConfig,
            permissions: permissionIds,
            venueId: venue._id,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      console.log(`✅ Created roles for venue: ${venue.name}`);
    }

    // 5. Create demo owner user if needed (ONLY for the first demo venue)
    const demoVenue = venues[0];
    const ownerExists = await User.findOne({ venueId: demoVenue._id, roleType: "owner" });

    if (!ownerExists) {
      console.log("\n👤 Creating demo owner user (Ensuring password is HASHED)...");

      const ownerRole = await Role.findOne({
        name: "Owner",
        venueId: demoVenue._id,
      });

      // --- CRITICAL FIX: Hash the password manually before creation ---
      const hashedPassword = await bcrypt.hash(DEFAULT_OWNER_PASSWORD, SALT_ROUNDS);

      const demoUser = await User.create({
        name: "Demo Owner",
        email: "owner@demo.com",
        password: hashedPassword, // Use the hashed password
        phone: "+1234567890",
        roleId: ownerRole._id,
        roleType: "owner",
        venueId: demoVenue._id,
        isActive: true,
      });
      
      // Update venue owner field with the new user's ID
      demoVenue.owner = demoUser._id;
      await demoVenue.save();

      console.log("✅ Created demo owner user");
      console.log(`\tEmail: ${demoUser.email}`);
      console.log(`\tPassword: ${DEFAULT_OWNER_PASSWORD} (Used for login)\n`);
    }

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("✨ All done! You can now start the server.\n");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding database:", error.message);
    process.exit(1);
  }
};

// Run if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  seedDatabase();
}

export default seedDatabase;
