import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  User,
  Venue,
  Role,
  Permission,
  Client,
  Partner,
  Event,
  Payment,
  Finance,
  Task,
  Reminder,
  VenueSpace,
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
    User,
    Venue,
    Role,
    Permission,
    Client,
    Partner,
    Event,
    Payment,
    Finance,
    Task,
    Reminder,
    VenueSpace,
    Invoice,
    InvoiceSettings,
    Contract,
    ContractSettings,
    Supply,
    SupplyCategory,
  ];

  for (const model of models) {
    await model.deleteMany({});
  }

  console.log("✅ Database cleared");
};

// =========================================================
// 1. PERMISSIONS
// =========================================================

const seedPermissions = async () => {
  console.log("\n📋 Seeding permissions...");

  const standardModules = [
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
  ];

  let permissionsList = [];

  // Standard CRUD
  standardModules.forEach((module) => {
    const capitalized = module.charAt(0).toUpperCase() + module.slice(1);
    permissionsList.push(
      {
        name: `${module}.create`,
        displayName: `Create ${capitalized}`,
        module,
        action: "create",
        scope: "all",
      },
      {
        name: `${module}.read.all`,
        displayName: `View All ${capitalized}`,
        module,
        action: "read",
        scope: "all",
      },
      {
        name: `${module}.update.all`,
        displayName: `Edit All ${capitalized}`,
        module,
        action: "update",
        scope: "all",
      },
      {
        name: `${module}.delete.all`,
        displayName: `Delete ${capitalized}`,
        module,
        action: "delete",
        scope: "all",
      }
    );
  });

  // Extras
  const extraPermissions = [
    {
      name: "events.read.own",
      displayName: "View Own Events",
      module: "events",
      action: "read",
      scope: "own",
    },
    {
      name: "events.update.own",
      displayName: "Edit Own Events",
      module: "events",
      action: "update",
      scope: "own",
    },
    {
      name: "tasks.read.own",
      displayName: "View Own Tasks",
      module: "tasks",
      action: "read",
      scope: "own",
    },
    {
      name: "tasks.update.own",
      displayName: "Edit Own Tasks",
      module: "tasks",
      action: "update",
      scope: "own",
    },
    {
      name: "reminders.read.own",
      displayName: "View Own Reminders",
      module: "reminders",
      action: "read",
      scope: "own",
    },
    {
      name: "reminders.update.own",
      displayName: "Edit Own Reminders",
      module: "reminders",
      action: "update",
      scope: "own",
    },
    {
      name: "events.export",
      displayName: "Export Events",
      module: "events",
      action: "export",
      scope: "all",
    },
    {
      name: "finance.export",
      displayName: "Export Finance",
      module: "finance",
      action: "export",
      scope: "all",
    },
    {
      name: "reports.read.all",
      displayName: "View Reports",
      module: "reports",
      action: "read",
      scope: "all",
    },
    {
      name: "venue.read",
      displayName: "View Venue Settings",
      module: "venue",
      action: "read",
      scope: "all",
    },
    {
      name: "venue.update",
      displayName: "Edit Venue Settings",
      module: "venue",
      action: "update",
      scope: "all",
    },
    {
      name: "settings.read",
      displayName: "View Global Settings",
      module: "settings",
      action: "read",
      scope: "all",
    },
    {
      name: "settings.update",
      displayName: "Edit Global Settings",
      module: "settings",
      action: "update",
      scope: "all",
    },
  ];

  permissionsList = [...permissionsList, ...extraPermissions];
  const createdPermissions = await Permission.insertMany(permissionsList);
  console.log(`✅ Created ${createdPermissions.length} permissions`);
  return createdPermissions;
};

// =========================================================
// 2. VENUES
// =========================================================

const seedVenues = async () => {
  console.log("\n🏛️  Seeding venues...");

  const venues = await Venue.create([
    {
      name: "Grand Palace Events",
      description: "Luxurious event venue in the heart of Tunis",
      address: {
        street: "Avenue Habib Bourguiba",
        city: "Tunis",
        state: "Tunis",
        zipCode: "1000",
        country: "Tunisia",
      },
      contact: { phone: "71123456", email: "contact@grandpalace.tn" },
      capacity: { min: 50, max: 500 },
      pricing: { basePrice: 5000 },
      operatingHours: {
        monday: { open: "09:00", close: "23:00", closed: false },
        sunday: { open: "10:00", close: "22:00", closed: false },
        // ... assumes defaults for others in model or just partial here
      },
      subscription: {
        plan: "annual",
        status: "active",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2025-12-31"),
        amount: 5000,
        currency: "TND",
        paymentMethod: "bank_transfer",
      },
      isActive: true,
      timeZone: "Africa/Tunis",
    },
  ]);

  console.log(`✅ Created ${venues.length} venues`);
  return venues;
};

// =========================================================
// 3. ROLES
// =========================================================

const seedRoles = async (venue, permissions) => {
  console.log("\n👥 Seeding roles...");

  const allPermissionIds = permissions.map((p) => p._id);

  const managerPerms = permissions
    .filter((p) => {
      if (p.module === "roles") return false;
      if (p.module === "users" && p.action === "delete") return false;
      if (p.module === "settings") return false;
      if (p.module === "venue" && p.action === "delete") return false;
      return true;
    })
    .map((p) => p._id);

  const staffPerms = permissions
    .filter((p) => {
      const operationalModules = [
        "events",
        "clients",
        "partners",
        "tasks",
        "reminders",
        "supplies",
      ];
      if (operationalModules.includes(p.module) && p.action === "read")
        return true;
      if (["tasks", "reminders"].includes(p.module) && p.action === "update")
        return true;
      return false;
    })
    .map((p) => p._id);

  const viewerPerms = permissions
    .filter((p) => p.action === "read" && p.scope === "all")
    .map((p) => p._id);

  const roles = await Role.create([
    {
      name: "Owner",
      description: "Full access to all features",
      venueId: venue._id,
      isSystemRole: true,
      permissions: allPermissionIds,
      level: 100,
    },
    {
      name: "Manager",
      description: "Can manage operations, finance, and staff",
      venueId: venue._id,
      isSystemRole: true,
      permissions: managerPerms,
      level: 75,
    },
    {
      name: "Staff",
      description: "Can view schedules and manage tasks",
      venueId: venue._id,
      isSystemRole: true,
      permissions: staffPerms,
      level: 50,
    },
    {
      name: "Viewer",
      description: "Read-only access",
      venueId: venue._id,
      isSystemRole: true,
      permissions: viewerPerms,
      level: 25,
    },
  ]);

  console.log(`✅ Created ${roles.length} roles`);
  return roles;
};

// =========================================================
// 4. USERS
// =========================================================

const seedUsers = async (venue, roles) => {
  console.log("\n👤 Seeding users...");

  const ownerRole = roles.find((r) => r.name === "Owner");
  const managerRole = roles.find((r) => r.name === "Manager");
  const staffRole = roles.find((r) => r.name === "Staff");

  const users = await User.create([
    {
      name: "Ahmed Slayem",
      email: "owner@demo.com",
      password: "password123",
      phone: "98123456",
      roleId: ownerRole._id,
      roleType: "owner",
      venueId: venue._id,
      isActive: true,
    },
    {
      name: "Fatima Ben Ali",
      email: "manager@demo.com",
      password: "password123",
      phone: "98234567",
      roleId: managerRole._id,
      roleType: "manager",
      venueId: venue._id,
      isActive: true,
    },
    {
      name: "Mohamed Trabelsi",
      email: "staff@demo.com",
      password: "password123",
      phone: "98345678",
      roleId: staffRole._id,
      roleType: "staff",
      venueId: venue._id,
      isActive: true,
    },
  ]);

  venue.owner = users[0]._id;
  await venue.save();

  console.log(`✅ Created ${users.length} users`);
  return users;
};

// =========================================================
// 5. SPACES
// =========================================================

const seedVenueSpaces = async (venue, owner) => {
  console.log("\n🏢 Seeding venue spaces...");

  const spaces = await VenueSpace.create([
    {
      name: "Grand Ballroom",
      description: "Our largest and most elegant space",
      capacity: { min: 100, max: 500 },
      basePrice: 8000,
      venueId: venue._id,
      owner: owner._id,
      isActive: true,
    },
    {
      name: "Garden Terrace",
      description: "Beautiful outdoor space",
      capacity: { min: 50, max: 200 },
      basePrice: 5000,
      venueId: venue._id,
      owner: owner._id,
      isActive: true,
    },
  ]);

  console.log(`✅ Created ${spaces.length} venue spaces`);
  return spaces;
};

// =========================================================
// 6. CLIENTS
// =========================================================

const seedClients = async (venue, createdBy) => {
  console.log("\n👥 Seeding clients...");

  const clients = await Client.create([
    {
      name: "Sarah & Karim Wedding",
      email: "sarah.karim@email.com",
      phone: "98111222",
      venueId: venue._id,
      status: "active",
      tags: ["wedding", "vip"],
      createdBy: createdBy._id,
    },
    {
      name: "TechCorp Tunisia",
      email: "events@techcorp.tn",
      phone: "71333444",
      venueId: venue._id,
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

const seedPartners = async (venue, createdBy) => {
  console.log("\n🤝 Seeding partners...");

  const partners = await Partner.create([
    {
      name: "Elite Catering Services",
      email: "contact@elitecatering.tn",
      phone: "71123456",
      venueId: venue._id,
      category: "catering",
      status: "active",
      createdBy: createdBy._id,
    },
    {
      name: "Studio Lumière",
      email: "booking@studiolumiere.tn",
      phone: "98222333",
      venueId: venue._id,
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

const seedSupplies = async (venue, createdBy) => {
  console.log("\n📦 Seeding supplies...");

  const categories = await SupplyCategory.initializeDefaults(
    venue._id,
    createdBy._id
  );
  const bevCat =
    categories.find((c) => c.name === "Beverages") || categories[0];

  const supplies = await Supply.create([
    {
      name: "Mineral Water (1.5L)",
      categoryId: bevCat._id,
      unit: "bottle",
      currentStock: 200,
      costPerUnit: 1.2,
      pricingType: "included",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Banquet Chairs",
      categoryId:
        categories.find((c) => c.name === "Equipment")?._id ||
        categories[0]._id,
      unit: "piece",
      currentStock: 300,
      costPerUnit: 0,
      pricingType: "included",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${supplies.length} supplies`);
  return { supplies };
};

// =========================================================
// 9. EVENTS
// =========================================================

const seedEvents = async (
  venue,
  spaces,
  clients,
  partners,
  supplies,
  createdBy
) => {
  console.log("\n🎉 Seeding events...");

  const events = await Event.create([
    {
      title: "Sarah & Karim Wedding Reception",
      type: "wedding",
      status: "confirmed",
      clientId: clients[0]._id,
      venueId: venue._id,
      venueSpaceId: spaces[0]._id,
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
      venueId: venue._id,
      venueSpaceId: spaces[0]._id,
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

// =========================================================
// 10. FINANCIALS & CONTRACTS (Fixed Reminder Fields)
// =========================================================

const seedFinancialsAndContracts = async (venue, events, clients, createdBy) => {
  console.log("\n💰 Seeding financials and contracts...");

  // 1. INVOICES
  await InvoiceSettings.getOrCreate(venue._id);
  
  await Invoice.create({
    venue: venue._id,
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
  await ContractSettings.getOrCreate(venue._id);
  
  const contractData = [
    {
      title: "Contrat de Location - Mariage Sarah & Karim",
      contractType: "client",
      status: "sent",
      version: 1,
      venue: venue._id,
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
    {
      title: "Contrat de Prestation - TechCorp Annual Gala",
      contractType: "client",
      status: "signed",
      version: 1,
      venue: venue._id,
      event: events[1]._id,
      createdBy: createdBy._id,
      party: { 
        type: "company", 
        name: "TechCorp Tunisia",
        phone: "71333444",
        identifier: "MF12345678",
        address: "Centre Urbain Nord, Tunis 1082, Tunisia"
      },
      logistics: {
        startDate: events[1].startDate,
        endDate: events[1].endDate,
        checkInTime: "18:00",
        checkOutTime: "23:59"
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
        depositAmount: 0,
        securityDeposit: 0,
        dueDate: generateFutureDate(85),
        isWithholdingTaxApplicable: true,
      },
      legal: {
        cancellationPolicy: "flexible",
        jurisdiction: "Tribunal de Tunis",
        specialConditions: "Retenue à la source applicable (1.5%).",
      },
      signatures: {
        venueSignedAt: new Date(),
        venueSignerIp: "192.168.1.1",
        clientSignedAt: new Date(),
        clientSignerIp: "192.168.1.100",
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
    venueId: venue._id,
    processedBy: createdBy._id,
  });

  // 4. TASKS
  await Task.create({
    title: "Finalize menu",
    status: "pending",
    priority: "high",
    dueDate: generateFutureDate(30),
    assignedTo: createdBy._id,
    venueId: venue._id,
    createdBy: createdBy._id,
  });

  // 5. REMINDERS (✅ FIXED)
  const targetDate = generateFutureDate(20);
  await Reminder.create({
    title: "Send final invoice",
    description: "Ensure the final invoice is sent to the client 10 days before the event",
    type: "payment",
    priority: "high",
    // ✅ Schema expects separate Date and Time fields
    reminderDate: targetDate, 
    reminderTime: "09:00", 
    status: "active",
    venueId: venue._id,
    createdBy: createdBy._id,
    assignedTo: [createdBy._id] // Good practice to assign it
  });

  console.log("✅ Financials & Contracts Seeded");
};
const seedSuperAdmin = async () => {
  console.log("\n👑 Seeding Super Admin...");
  
  // Check if exists
  const exists = await User.findOne({ email: "admin@fiesta.events" });
  if (exists) return;

  await User.create({
    name: "Super Admin",
    email: "admin@fiesta.events",
    password: "supersecretpassword", // Change this!
    phone: "00000000",
    isSuperAdmin: true,
    // No businessId needed due to schema change
    isActive: true,
    roleType: "owner" // Just a placeholder, isSuperAdmin overrides permissions
  });
  
  console.log("✅ Super Admin created: admin@fiesta.events");
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

    const permissions = await seedPermissions();
    const venues = await seedVenues();
    const roles = await seedRoles(venues[0], permissions);
    const users = await seedUsers(venues[0], roles);

    const owner = users[0];
    const spaces = await seedVenueSpaces(venues[0], owner);
    const clients = await seedClients(venues[0], owner);
    const partners = await seedPartners(venues[0], owner);
    const { supplies } = await seedSupplies(venues[0], owner);

    const events = await seedEvents(
      venues[0],
      spaces,
      clients,
      partners,
      supplies,
      owner
    );

    await seedFinancialsAndContracts(venues[0], events, clients, owner);

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
