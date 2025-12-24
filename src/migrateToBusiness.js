import mongoose from "mongoose";
import dotenv from "dotenv";

// Load .env from root
dotenv.config();

const migrate = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("❌ MONGODB_URI is undefined. Check your .env file.");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🔌 Connected to DB");

    const db = mongoose.connection.db;

    // 1. Check Collections
    const venuesCollection = await db.listCollections({ name: 'venues' }).toArray();
    const businessesCollection = await db.listCollections({ name: 'businesses' }).toArray();
    
    const venuesExists = venuesCollection.length > 0;
    const businessesExists = businessesCollection.length > 0;

    // 2. Handle Rename Logic safely
    if (venuesExists) {
      if (businessesExists) {
        console.log("⚠️ 'businesses' collection already exists. Dropping it to migrate 'venues'...");
        await db.collection('businesses').drop();
      }
      console.log("🔄 Renaming 'venues' collection to 'businesses'...");
      await db.collection('venues').rename('businesses');
    } else if (businessesExists) {
      console.log("ℹ️ 'venues' collection not found, assuming already renamed to 'businesses'. Continuing...");
    } else {
      console.log("❌ No 'venues' or 'businesses' collection found. Nothing to migrate.");
      return;
    }

    // 3. Transform Data Structure
    console.log("🛠️  Migrating Business data structure...");
    const businesses = await db.collection('businesses').find({}).toArray();

    for (const biz of businesses) {
      // If already migrated (has category), skip
      if (biz.category) continue;

      console.log(`Processing: ${biz.name}`);

      const update = {
        $set: {
          category: 'venue', // Default to venue
          venueDetails: {
            capacity: biz.capacity || { min: 0, max: 0 },
            amenities: biz.amenities || [],
            operatingHours: biz.operatingHours || {},
            pricing: biz.pricing || { basePrice: 0 }
          },
          // Initialize service details empty
          serviceDetails: {
            priceType: 'fixed',
            portfolio: []
          }
        },
        $unset: {
          // Remove old root fields that moved to venueDetails
          capacity: "",
          amenities: "",
          operatingHours: "",
          pricing: ""
        }
      };

      await db.collection('businesses').updateOne({ _id: biz._id }, update);
    }

    // 4. Update References (venueId -> businessId)
    const collectionsToUpdate = [
      'users', 'roles', 'events', 'clients', 'partners', 
      'invoices', 'contracts', 'supplies', 'tasks', 'reminders', 'venuespaces'
    ];

    for (const colName of collectionsToUpdate) {
       // Check if collection exists first
       const colExists = (await db.listCollections({ name: colName }).toArray()).length > 0;
       
       if (colExists) {
         console.log(`🔗 Updating references in '${colName}'...`);
         await db.collection(colName).updateMany(
          { venueId: { $exists: true } },
          { $rename: { "venueId": "businessId" } }
        );
       }
    }

    console.log("✅ Migration Complete!");

  } catch (error) {
    console.error("❌ Migration Failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Connection Closed");
  }
};

migrate();