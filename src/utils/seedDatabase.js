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
} from "../models/index.js";

dotenv.config();

// =========================================================
// UTILITY FUNCTIONS
// =========================================================

const generateRandomDate = (start, end) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

const generateFutureDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

// =========================================================
// CONNECT TO DATABASE
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

// =========================================================
// CLEAR DATABASE
// =========================================================

const clearDatabase = async () => {
  console.log("\n🗑️  Clearing database...");

  const models = [
    User, Business, Role, Permission, Client, Partner, Event,
    Payment, Finance, Task, Reminder, Space, Invoice,
    InvoiceSettings, Contract, ContractSettings, Supply, SupplyCategory,
  ];

  for (const model of models) {
    if (model) await model.deleteMany({});
  }

  console.log("✅ Database cleared");
};

// =========================================================
// 1. PERMISSIONS
// =========================================================

const seedPermissions = async () => {
  console.log("\n📋 Seeding permissions...");

  const standardModules = [
    "events", "clients", "partners", "supplies", "finance",
    "payments", "invoices", "contracts", "tasks", "reminders",
    "users", "roles", "business", "portfolio"
  ];

  let permissionsList = [];

  standardModules.forEach((module) => {
    const capitalized = module.charAt(0).toUpperCase() + module.slice(1);
    permissionsList.push(
      { name: `${module}.create`, displayName: `Create ${capitalized}`, module, action: "create", scope: "all" },
      { name: `${module}.read.all`, displayName: `View All ${capitalized}`, module, action: "read", scope: "all" },
      { name: `${module}.update.all`, displayName: `Edit All ${capitalized}`, module, action: "update", scope: "all" },
      { name: `${module}.delete.all`, displayName: `Delete ${capitalized}`, module, action: "delete", scope: "all" }
    );
  });

  const extraPermissions = [
    { name: "events.read.own", displayName: "View Own Events", module: "events", action: "read", scope: "own" },
    { name: "events.update.own", displayName: "Edit Own Events", module: "events", action: "update", scope: "own" },
    { name: "tasks.read.own", displayName: "View Own Tasks", module: "tasks", action: "read", scope: "own" },
    { name: "tasks.update.own", displayName: "Edit Own Tasks", module: "tasks", action: "update", scope: "own" },
    { name: "reminders.read.own", displayName: "View Own Reminders", module: "reminders", action: "read", scope: "own" },
    { name: "reminders.update.own", displayName: "Edit Own Reminders", module: "reminders", action: "update", scope: "own" },
    { name: "settings.read", displayName: "View Global Settings", module: "settings", action: "read", scope: "all" },
  ];

  permissionsList = [...permissionsList, ...extraPermissions];
  const createdPermissions = await Permission.insertMany(permissionsList);
  console.log(`✅ Created ${createdPermissions.length} permissions`);
  return createdPermissions;
};

// =========================================================
// 2. BUSINESSES
// =========================================================

// Accepts a pre-generated ownerId to satisfy validation
const seedBusinesses = async (ownerId) => {
  console.log("\n🏛️  Seeding businesses...");

  const businesses = await Business.create([
    {
      name: "Grand Palace Events",
      category: "venue",
      owner: ownerId, // ✅ Validation Fix: Pass the ID here
      description: "Luxurious event venue in the heart of Tunis",
      address: {
        street: "Avenue Habib Bourguiba",
        city: "Tunis",
        state: "Tunis",
        zipCode: "1000",
        country: "Tunisia",
      },
      contact: { phone: "71123456", email: "contact@grandpalace.tn" },
      venueDetails: {
        capacity: { min: 50, max: 500 },
        amenities: ["Wifi", "Parking", "Catering Kitchen"],
        pricing: { basePrice: 5000 },
        operatingHours: {
          monday: { open: "09:00", close: "23:00", closed: false },
          sunday: { open: "10:00", close: "22:00", closed: false },
        },
      },
      subscription: {
        plan: "pro", // ✅ Validation Fix: Changed from 'annual' to 'pro'
        status: "active",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2025-12-31"),
      },
      isActive: true,
    },
  ]);

  console.log(`✅ Created ${businesses.length} businesses`);
  return businesses;
};

// =========================================================
// 3. ROLES
// =========================================================

const seedRoles = async (business, permissions) => {
  console.log("\n👥 Seeding roles...");

  const allPermissionIds = permissions.map((p) => p._id);

  const roles = await Role.create([
    {
      name: "Owner",
      description: "Full access to all features",
      businessId: business._id,
      isSystemRole: true,
      permissions: allPermissionIds,
      level: 100,
    },
    {
      name: "Manager",
      description: "Can manage operations, finance, and staff",
      businessId: business._id,
      isSystemRole: true,
      permissions: allPermissionIds.slice(0, 20),
      level: 75,
    },
    {
      name: "Staff",
      description: "Can view schedules and manage tasks",
      businessId: business._id,
      isSystemRole: true,
      permissions: [],
      level: 50,
    },
  ]);

  console.log(`✅ Created ${roles.length} roles`);
  return roles;
};

// =========================================================
// 4. USERS
// =========================================================

const seedUsers = async (business, roles, ownerId) => {
  console.log("\n👤 Seeding users...");

  const ownerRole = roles.find((r) => r.name === "Owner");
  const managerRole = roles.find((r) => r.name === "Manager");
  const staffRole = roles.find((r) => r.name === "Staff");

  const users = await User.create([
    {
      _id: ownerId, // ✅ Use the pre-generated ID to match the Business owner field
      name: "Ahmed Slayem",
      email: "owner@demo.com",
      password: "password123",
      phone: "98123456",
      roleId: ownerRole._id,
      roleType: "owner",
      businessId: business._id,
      isActive: true,
    },
    {
      name: "Fatima Ben Ali",
      email: "manager@demo.com",
      password: "password123",
      phone: "98234567",
      roleId: managerRole._id,
      roleType: "manager",
      businessId: business._id,
      isActive: true,
    },
    {
      name: "Mohamed Trabelsi",
      email: "staff@demo.com",
      password: "password123",
      phone: "98345678",
      roleId: staffRole._id,
      roleType: "staff",
      businessId: business._id,
      isActive: true,
    },
  ]);

  console.log(`✅ Created ${users.length} users`);
  return users;
};

// =========================================================
// 5. SPACES
// =========================================================

const seedSpaces = async (business, owner) => {
  console.log("\n🏢 Seeding spaces...");

  const spaces = await Space.create([
    {
      name: "Grand Ballroom",
      type: "room",
      description: "Our largest and most elegant space",
      capacity: { min: 100, max: 500 },
      basePrice: 8000,
      businessId: business._id,
      owner: owner._id,
      isActive: true,
    },
    {
      name: "Garden Terrace",
      type: "room",
      description: "Beautiful outdoor space",
      capacity: { min: 50, max: 200 },
      basePrice: 5000,
      businessId: business._id,
      owner: owner._id,
      isActive: true,
    },
  ]);

  // Update business venueDetails
  business.venueDetails.spaces = spaces.map(s => s._id);
  await business.save();

  console.log(`✅ Created ${spaces.length} spaces`);
  return spaces;
};

// =========================================================
// 6. CLIENTS
// =========================================================

const seedClients = async (business, createdBy) => {
  console.log("\n👥 Seeding clients...");

  const clients = await Client.create([
    {
      name: "Sarah & Karim Wedding",
      email: "sarah.karim@email.com",
      phone: "98111222",
      businessId: business._id,
      status: "active",
      tags: ["wedding", "vip"],
      createdBy: createdBy._id,
    },
    {
      name: "TechCorp Tunisia",
      email: "events@techcorp.tn",
      phone: "71333444",
      businessId: business._id,
      status: "active",
      company: "TechCorp Tunisia",
      tags: ["corporate", "recurring"],
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${clients.length} clients`);
  return clients;
};

// =========================================================
// 7. PARTNERS
// =========================================================

const seedPartners = async (business, createdBy) => {
  console.log("\n🤝 Seeding partners...");

  const partners = await Partner.create([
    {
      name: "Elite Catering Services",
      email: "contact@elitecatering.tn",
      phone: "71123456",
      businessId: business._id,
      category: "catering",
      status: "active",
      createdBy: createdBy._id,
    },
    {
      name: "Studio Lumière",
      email: "booking@studiolumiere.tn",
      phone: "98222333",
      businessId: business._id,
      category: "photography",
      status: "active",
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${partners.length} partners`);
  return partners;
};

// =========================================================
// 8. SUPPLIES
// =========================================================

const seedSupplies = async (business, createdBy) => {
  console.log("\n📦 Seeding supplies...");

  const categories = await SupplyCategory.initializeDefaults(
    business._id,
    createdBy._id
  );
  const bevCat = categories.find((c) => c.name === "Beverages") || categories[0];

  const supplies = await Supply.create([
    {
      name: "Mineral Water (1.5L)",
      categoryId: bevCat._id,
      unit: "bottle",
      currentStock: 200,
      costPerUnit: 1.2,
      pricingType: "included",
      businessId: business._id,
      createdBy: createdBy._id,
    },
    {
      name: "Banquet Chairs",
      categoryId: categories.find((c) => c.name === "Equipment")?._id || categories[0]._id,
      unit: "piece",
      currentStock: 300,
      costPerUnit: 0,
      pricingType: "included",
      businessId: business._id,
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${supplies.length} supplies`);
  return { supplies };
};

// =========================================================
// 9. EVENTS
// =========================================================

const seedEvents = async (business, spaces, clients, partners, supplies, createdBy) => {
  console.log("\n🎉 Seeding events...");

  const events = await Event.create([
    {
      title: "Sarah & Karim Wedding Reception",
      type: "wedding",
      status: "confirmed",
      clientId: clients[0]._id,
      businessId: business._id,
      resourceId: spaces[0]._id,
      startDate: generateFutureDate(45),
      endDate: generateFutureDate(45),
      startTime: "18:00",
      endTime: "23:30",
      guestCount: 350,
      pricing: { basePrice: 8000, taxRate: 19 },
      createdBy: createdBy._id,
    },
    {
      title: "TechCorp Annual Gala 2025",
      type: "corporate",
      status: "confirmed",
      clientId: clients[1]._id,
      businessId: business._id,
      resourceId: spaces[0]._id,
      startDate: generateFutureDate(90),
      endDate: generateFutureDate(90),
      startTime: "19:00",
      endTime: "23:00",
      guestCount: 250,
      pricing: { basePrice: 8000, taxRate: 19 },
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${events.length} events`);
  return events;
};

// =========================================================
// 10. FINANCIALS & CONTRACTS
// =========================================================

const seedFinancialsAndContracts = async (business, events, clients, createdBy) => {
  console.log("\n💰 Seeding financials and contracts...");

  // 1. INVOICES
  await InvoiceSettings.getOrCreate(business._id);
  
  await Invoice.create({
    business: business._id,
    invoiceType: "client",
    status: "sent",
    client: clients[0]._id,
    event: events[0]._id,
    recipientName: "Sarah & Karim",
    recipientPhone: "98111222",
    issueDate: new Date(),
    dueDate: generateFutureDate(30),
    items: [{ description: "Venue Rental", quantity: 1, rate: 8000, amount: 8000 }],
    subtotal: 8000,
    taxAmount: 1520,
    totalAmount: 9520,
    createdBy: createdBy._id,
  });

  // 2. CONTRACTS
  await ContractSettings.getOrCreate(business._id);
  
  const contractData = [
    {
      title: "Contrat de Location - Mariage Sarah & Karim",
      contractType: "client",
      status: "sent",
      version: 1,
      business: business._id,
      event: events[0]._id,
      createdBy: createdBy._id,
      party: { 
        type: "individual", 
        name: "Sarah & Karim",
        phone: "98111222",
        identifier: "CIN12345678",
        address: "15 Rue de Carthage, Tunis 1000, Tunisia"
      },
      logistics: {
        startDate: events[0].startDate,
        endDate: events[0].endDate,
        checkInTime: "16:00",
        checkOutTime: "00:00"
      },
      financials: {
        currency: "TND",
        amountHT: 8000,
        vatRate: 19,
        taxAmount: 1520,
        stampDuty: 1.0,
        totalTTC: 9520,
      },
      paymentTerms: {
        depositAmount: 5000,
        securityDeposit: 1000,
        dueDate: generateFutureDate(30),
        isWithholdingTaxApplicable: false,
      },
      legal: {
        cancellationPolicy: "standard",
        jurisdiction: "Tribunal de Tunis",
        specialConditions: "Client agrees to vacate premises by midnight.",
      },
    },
  ];

  for (const data of contractData) {
    await Contract.create(data);
  }

  // 3. PAYMENTS
  await Payment.create({
    event: events[0]._id,
    client: clients[0]._id,
    type: "income",
    amount: 5000,
    method: "bank_transfer",
    status: "completed",
    description: "Deposit",
    businessId: business._id,
    processedBy: createdBy._id,
  });

  // 4. TASKS
  await Task.create({
    title: "Finalize menu",
    status: "pending",
    priority: "high",
    dueDate: generateFutureDate(30),
    assignedTo: createdBy._id,
    businessId: business._id,
    createdBy: createdBy._id,
  });

  // 5. REMINDERS
  const targetDate = generateFutureDate(20);
  await Reminder.create({
    title: "Send final invoice",
    description: "Ensure the final invoice is sent to the client 10 days before the event",
    type: "payment",
    priority: "high",
    reminderDate: targetDate, 
    reminderTime: "09:00", 
    status: "active",
    businessId: business._id,
    createdBy: createdBy._id,
    assignedTo: [createdBy._id]
  });

  console.log("✅ Financials & Contracts Seeded");
};

// =========================================================
// MAIN EXECUTION
// =========================================================

const seedDatabase = async () => {
  try {
    console.log("\n🌱 Starting database seed...\n");
    console.log("═".repeat(60));

    await connectDB();
    await clearDatabase();

    // 1. Generate IDs for core entities upfront to resolve circular dependency
    const ownerId = new mongoose.Types.ObjectId();

    const permissions = await seedPermissions();
    const businesses = await seedBusinesses(ownerId); // Pass ownerId
    const roles = await seedRoles(businesses[0], permissions);
    const users = await seedUsers(businesses[0], roles, ownerId); // Pass ownerId

    const owner = users[0];
    const spaces = await seedSpaces(businesses[0], owner);
    const clients = await seedClients(businesses[0], owner);
    const partners = await seedPartners(businesses[0], owner);
    const { supplies } = await seedSupplies(businesses[0], owner);

    const events = await seedEvents(
      businesses[0],
      spaces,
      clients,
      partners,
      supplies,
      owner
    );

    await seedFinancialsAndContracts(businesses[0], events, clients, owner);

    console.log("\n" + "═".repeat(60));
    console.log("\n✅ DATABASE SEEDED SUCCESSFULLY!\n");
    console.log("   Owner:   owner@demo.com / password123");
    console.log("   Manager: manager@demo.com / password123");
    console.log("   Staff:   staff@demo.com / password123");
    console.log("\n" + "═".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();