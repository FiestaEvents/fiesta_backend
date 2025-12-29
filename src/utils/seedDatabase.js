import mongoose from "mongoose";
import dotenv from "dotenv";

import {
  User,
  Business,
  Role,
  Permission,
  Client,
  Partner,
  Event,
  Payment,
  Finance,
  Task,
  Reminder,
  Space,
  Invoice,
  InvoiceSettings,
  Contract,
  ContractSettings,
  Supply,
  SupplyCategory,
  Portfolio,
} from "../models/index.js";

dotenv.config();

// =========================================================
// 1. HELPERS
// =========================================================

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const futureDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const pastDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

// =========================================================
// 2. CLEAR DB
// =========================================================

const clearDatabase = async () => {
  console.log("\n🗑️  Clearing database...");
  const models = [
    User,
    Business,
    Role,
    Permission,
    Client,
    Partner,
    Event,
    Payment,
    Finance,
    Task,
    Reminder,
    Space,
    Invoice,
    InvoiceSettings,
    Contract,
    ContractSettings,
    Supply,
    SupplyCategory,
    Portfolio,
  ];

  for (const model of models) {
    if (model) await model.deleteMany({});
  }
  console.log("✅ Database cleared");
};

// =========================================================
// 3. SEED PERMISSIONS
// =========================================================

const seedPermissions = async () => {
  console.log("\n📋 Seeding permissions...");
  const modules = [
    "events",
    "clients",
    "partners",
    "supplies",
    "finance",
    "payments",
    "invoices",
    "contracts",
    "tasks",
    "reminders",
    "users",
    "roles",
    "business",
    "portfolio",
  ];

  let list = [];
  modules.forEach((mod) => {
    const Cap = mod.charAt(0).toUpperCase() + mod.slice(1);
    list.push(
      {
        name: `${mod}.create`,
        displayName: `Create ${Cap}`,
        module: mod,
        action: "create",
        scope: "all",
      },
      {
        name: `${mod}.read.all`,
        displayName: `Read All ${Cap}`,
        module: mod,
        action: "read",
        scope: "all",
      },
      {
        name: `${mod}.update.all`,
        displayName: `Update All ${Cap}`,
        module: mod,
        action: "update",
        scope: "all",
      },
      {
        name: `${mod}.delete.all`,
        displayName: `Delete ${Cap}`,
        module: mod,
        action: "delete",
        scope: "all",
      }
    );
  });

  // Extras
  list.push(
    {
      name: "settings.read",
      displayName: "Read Settings",
      module: "settings",
      action: "read",
      scope: "all",
    },
    {
      name: "events.read.own",
      displayName: "Read Own Events",
      module: "events",
      action: "read",
      scope: "own",
    },
    {
      name: "events.update.own",
      displayName: "Update Own Events",
      module: "events",
      action: "update",
      scope: "own",
    }
  );

  await Permission.insertMany(list);
  return await Permission.find({});
};

// =========================================================
// 4. CONFIG
// =========================================================

const CATEGORY_CONFIG = {
  venue: {
    resources: [
      {
        name: "Grand Ballroom",
        type: "room",
        capacity: { min: 50, max: 500 },
        basePrice: 5000,
      },
      {
        name: "Garden Terrace",
        type: "room",
        capacity: { min: 20, max: 150 },
        basePrice: 2500,
      },
    ],
    eventTitles: [
      "Wedding Reception",
      "Corporate Gala",
      "Tech Conference",
      "Summer Party",
    ],
    supplies: ["Chairs", "Tables", "Napkins", "Glassware"],
  },
  driver: {
    resources: [
      {
        name: "Mercedes S-Class",
        type: "vehicle",
        capacity: { min: 1, max: 4 },
        basePrice: 400,
      },
      {
        name: "V-Class Van",
        type: "vehicle",
        capacity: { min: 1, max: 7 },
        basePrice: 600,
      },
    ],
    eventTitles: [
      "Airport Transfer",
      "Wedding Shuttle",
      "VIP City Tour",
      "Delegation Transport",
    ],
    supplies: ["Water Bottles", "Fuel Card"],
  },
  photography: {
    resources: [],
    eventTitles: [
      "Wedding Shoot",
      "Product Catalog",
      "Family Portrait",
      "Fashion Editorial",
    ],
    supplies: ["SD Cards", "Batteries"],
  },
  catering: {
    resources: [],
    eventTitles: [
      "Wedding Buffet",
      "Corporate Lunch",
      "Private Dinner",
      "Cocktail Hour",
    ],
    supplies: ["Flour", "Sugar", "Spices", "Packaging"],
  },
};

// =========================================================
// 5. TENANT BUILDER
// =========================================================

const seedTenant = async (config, permissions) => {
  console.log(
    `\n🏗️  Building Tenant: ${config.businessName} (${config.category})...`
  );

  const ownerId = new mongoose.Types.ObjectId();
  const businessId = new mongoose.Types.ObjectId();
  const tenantData = CATEGORY_CONFIG[config.category];

  // A. Business
  await Business.create({
    _id: businessId,
    name: config.businessName,
    category: config.category,
    owner: ownerId,
    description: `Premium ${config.category} services.`,
    address: {
      street: "123 Main St",
      city: "Tunis",
      country: "Tunisia",
      zipCode: "1000",
    },
    contact: { phone: "71000000", email: config.email },
    subscription: { plan: "pro", status: "active", startDate: new Date() },
    venueDetails:
      config.category === "venue"
        ? { capacity: { min: 10, max: 1000 } }
        : undefined,
    serviceDetails:
      config.category !== "venue"
        ? { serviceRadiusKM: 50, pricingModel: "fixed" }
        : undefined,
  });

  // Settings
  await InvoiceSettings.getOrCreate(businessId);
  await ContractSettings.getOrCreate(businessId);

  // B. Roles
  const permIds = permissions.map((p) => p._id);
  const ownerRole = await Role.create({
    name: "Owner",
    businessId,
    isSystemRole: true,
    level: 100,
    permissions: permIds,
  });
  const managerRole = await Role.create({
    name: "Manager",
    businessId,
    isSystemRole: true,
    level: 75,
    permissions: permIds,
  });
  const staffRole = await Role.create({
    name: "Staff",
    businessId,
    isSystemRole: true,
    level: 50,
    permissions: [],
  });

  // C. Users (✅ FIXED: Use loop + create to trigger password hashing)
  const usersData = [
    {
      _id: ownerId,
      name: config.userName,
      email: config.email,
      password: "password123",
      roleId: ownerRole._id,
      roleType: "owner",
      businessId,
      isActive: true,
    },
    {
      name: "Manager User",
      email: `manager.${config.category}@demo.com`,
      password: "password123",
      roleId: managerRole._id,
      roleType: "manager",
      businessId,
      isActive: true,
    },
    {
      name: "Staff User",
      email: `staff.${config.category}@demo.com`,
      password: "password123",
      roleId: staffRole._id,
      roleType: "staff",
      businessId,
      isActive: true,
    },
  ];

  const users = [];
  for (const u of usersData) {
    // ✅ This triggers the pre-save hook (bcrypt hash)
    const user = await User.create(u);
    users.push(user);
  }

  // D. Resources
  const createdResources = [];
  for (const res of tenantData.resources) {
    const space = await Space.create({
      ...res,
      businessId,
      owner: ownerId,
      isActive: true,
    });
    createdResources.push(space);
  }

  // E. Clients & Partners
  const clients = await Client.insertMany([
    {
      name: "Client One",
      email: `c1.${config.category}@test.com`,
      phone: "20000001",
      businessId,
      status: "active",
      createdBy: ownerId,
    },
    {
      name: "Client Two",
      email: `c2.${config.category}@test.com`,
      phone: "20000002",
      businessId,
      status: "active",
      createdBy: ownerId,
    },
    {
      name: "Client Three",
      email: `c3.${config.category}@test.com`,
      phone: "20000003",
      businessId,
      status: "active",
      createdBy: ownerId,
    },
  ]);

  const partners = await Partner.insertMany([
    {
      name: "Vendor A",
      category: "other",
      email: `v1.${config.category}@test.com`,
      phone: "50000001",
      businessId,
      createdBy: ownerId,
    },
  ]);

  // F. Inventory
  const cat = await SupplyCategory.create({
    name: "General",
    businessId,
    createdBy: ownerId,
  });
  for (const itemName of tenantData.supplies) {
    await Supply.create({
      name: itemName,
      categoryId: cat._id,
      unit: "unit",
      currentStock: randomInt(10, 100),
      costPerUnit: randomInt(5, 50),
      businessId,
      createdBy: ownerId,
    });
  }

  // G. Portfolio
  if (config.category === "photography" || config.category === "videography") {
    await Portfolio.create({
      title: "Summer Wedding Highlights",
      category: "Wedding",
      description: "Best shots from 2024 season",
      items: [
        {
          url: "https://via.placeholder.com/800x600",
          type: "image",
          isCover: true,
        },
      ],
      businessId,
      createdBy: ownerId,
    });
  }

  // H. Events & Financials
  for (let i = 0; i < 12; i++) {
    const isPast = i < 5;
    const date = isPast ? pastDate(i * 5 + 2) : futureDate(i * 3 + 2);
    const status = isPast ? "completed" : "confirmed";
    const client = getRandom(clients);
    const resource =
      createdResources.length > 0 ? getRandom(createdResources) : null;
    const title = `${getRandom(tenantData.eventTitles)} - ${client.name}`;
    const price = resource ? resource.basePrice + 500 : 1500;

    const event = await Event.create({
      title,
      type: "wedding",
      status,
      clientId: client._id,
      businessId,
      resourceId: resource ? resource._id : undefined,
      startDate: date,
      endDate: date,
      startTime: "14:00",
      endTime: "23:00",
      guestCount: 100,
      pricing: {
        basePrice: price,
        taxRate: 19,
        totalPriceAfterTax: price * 1.19,
      },
      paymentInfo: {
        status: isPast ? "paid" : "unpaid",
        paidAmount: isPast ? price * 1.19 : 0,
      },
      createdBy: ownerId,
    });

    await Invoice.create({
      business: businessId,
      invoiceType: "client",
      status: isPast ? "paid" : "sent",
      client: client._id,
      event: event._id,
      recipientName: client.name,
      issueDate: date,
      dueDate: futureDate(15),
      items: [
        { description: "Service Fee", quantity: 1, rate: price, amount: price },
      ],
      subtotal: price,
      totalAmount: price * 1.19,
      createdBy: ownerId,
    });

    if (isPast) {
      await Payment.create({
        event: event._id,
        client: client._id,
        type: "income",
        amount: price * 1.19,
        method: "bank_transfer",
        status: "completed",
        description: `Payment for ${title}`,
        businessId,
        processedBy: ownerId,
        createdAt: date,
      });
    }
  }

  console.log(`✅ ${config.businessName} seeded.`);
};

// =========================================================
// 6. EXECUTION
// =========================================================

const seedDatabase = async () => {
  try {
    await connectDB();
    await clearDatabase();

    const permissions = await seedPermissions();

    await seedTenant(
      {
        category: "venue",
        businessName: "Grand Palace",
        email: "venue@demo.com",
        userName: "Venue Owner",
      },
      permissions
    );
    await seedTenant(
      {
        category: "photography",
        businessName: "Lumiere Studio",
        email: "photo@demo.com",
        userName: "Photo Owner",
      },
      permissions
    );
    await seedTenant(
      {
        category: "driver",
        businessName: "Elite Transport",
        email: "driver@demo.com",
        userName: "Driver Owner",
      },
      permissions
    );
    await seedTenant(
      {
        category: "catering",
        businessName: "Tasty Bites",
        email: "chef@demo.com",
        userName: "Chef Owner",
      },
      permissions
    );

    console.log("\n=======================================================");
    console.log("🎉  DATABASE SEEDED SUCCESSFULLY");
    console.log("=======================================================");
    console.log("Login with (Password: password123):");
    console.log(" - venue@demo.com");
    console.log(" - photo@demo.com");
    console.log(" - driver@demo.com");
    console.log(" - chef@demo.com");
    console.log("=======================================================\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
