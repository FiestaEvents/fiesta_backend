import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
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

  await User.deleteMany({});
  await Venue.deleteMany({});
  await Role.deleteMany({});
  await Permission.deleteMany({});
  await Client.deleteMany({});
  await Partner.deleteMany({});
  await Event.deleteMany({});
  await Payment.deleteMany({});
  await Finance.deleteMany({});
  await Task.deleteMany({});
  await Reminder.deleteMany({});
  await VenueSpace.deleteMany({});
  await Invoice.deleteMany({});
  await InvoiceSettings.deleteMany({});
  await Contract.deleteMany({});
  await ContractSettings.deleteMany({});
  await Supply.deleteMany({});
  await SupplyCategory.deleteMany({});

  console.log("✅ Database cleared");
};

// =========================================================
// SEED PERMISSIONS
// =========================================================

const seedPermissions = async () => {
  console.log("\n📋 Seeding permissions...");

  const permissions = [
    // Events
    {
      name: "events:create",
      displayName: "Create Events",
      module: "events",
      action: "create",
    },
    {
      name: "events:read",
      displayName: "View Events",
      module: "events",
      action: "read",
    },
    {
      name: "events:update",
      displayName: "Update Events",
      module: "events",
      action: "update",
    },
    {
      name: "events:delete",
      displayName: "Delete Events",
      module: "events",
      action: "delete",
    },

    // Clients
    {
      name: "clients:create",
      displayName: "Create Clients",
      module: "clients",
      action: "create",
    },
    {
      name: "clients:read",
      displayName: "View Clients",
      module: "clients",
      action: "read",
    },
    {
      name: "clients:update",
      displayName: "Update Clients",
      module: "clients",
      action: "update",
    },
    {
      name: "clients:delete",
      displayName: "Delete Clients",
      module: "clients",
      action: "delete",
    },

    // Partners
    {
      name: "partners:create",
      displayName: "Create Partners",
      module: "partners",
      action: "create",
    },
    {
      name: "partners:read",
      displayName: "View Partners",
      module: "partners",
      action: "read",
    },
    {
      name: "partners:update",
      displayName: "Update Partners",
      module: "partners",
      action: "update",
    },
    {
      name: "partners:delete",
      displayName: "Delete Partners",
      module: "partners",
      action: "delete",
    },

    // Finance
    {
      name: "finance:create",
      displayName: "Create Finance Records",
      module: "finance",
      action: "create",
    },
    {
      name: "finance:read",
      displayName: "View Finance",
      module: "finance",
      action: "read",
    },
    {
      name: "finance:update",
      displayName: "Update Finance",
      module: "finance",
      action: "update",
    },
    {
      name: "finance:delete",
      displayName: "Delete Finance",
      module: "finance",
      action: "delete",
    },

    // Payments
    {
      name: "payments:create",
      displayName: "Create Payments",
      module: "payments",
      action: "create",
    },
    {
      name: "payments:read",
      displayName: "View Payments",
      module: "payments",
      action: "read",
    },
    {
      name: "payments:update",
      displayName: "Update Payments",
      module: "payments",
      action: "update",
    },

    // Tasks
    {
      name: "tasks:create",
      displayName: "Create Tasks",
      module: "tasks",
      action: "create",
    },
    {
      name: "tasks:read",
      displayName: "View Tasks",
      module: "tasks",
      action: "read",
    },
    {
      name: "tasks:update",
      displayName: "Update Tasks",
      module: "tasks",
      action: "update",
    },
    {
      name: "tasks:delete",
      displayName: "Delete Tasks",
      module: "tasks",
      action: "delete",
    },

    // Reminders
    {
      name: "reminders:create",
      displayName: "Create Reminders",
      module: "reminders",
      action: "create",
    },
    {
      name: "reminders:read",
      displayName: "View Reminders",
      module: "reminders",
      action: "read",
    },
    {
      name: "reminders:update",
      displayName: "Update Reminders",
      module: "reminders",
      action: "update",
    },
    {
      name: "reminders:delete",
      displayName: "Delete Reminders",
      module: "reminders",
      action: "delete",
    },

    // Users & Roles
    {
      name: "users:manage",
      displayName: "Manage Users",
      module: "users",
      action: "manage",
    },
    {
      name: "roles:manage",
      displayName: "Manage Roles",
      module: "roles",
      action: "manage",
    },

    // Venue
    {
      name: "venue:manage",
      displayName: "Manage Venue",
      module: "venue",
      action: "manage",
    },

    // Reports
    {
      name: "reports:view",
      displayName: "View Reports",
      module: "reports",
      action: "read",
    },
    {
      name: "reports:export",
      displayName: "Export Reports",
      module: "reports",
      action: "export",
    },

    // Settings
    {
      name: "settings:manage",
      displayName: "Manage Settings",
      module: "settings",
      action: "manage",
    },
  ];

  const createdPermissions = await Permission.insertMany(permissions);
  console.log(`✅ Created ${createdPermissions.length} permissions`);

  return createdPermissions;
};

// =========================================================
// SEED VENUES
// =========================================================

const seedVenues = async () => {
  console.log("\n🏛️  Seeding venues...");

  const venues = await Venue.create([
    {
      name: "Grand Palace Events",
      description:
        "Luxurious event venue in the heart of Tunis with state-of-the-art facilities",
      address: {
        street: "Avenue Habib Bourguiba",
        city: "Tunis",
        state: "Tunis",
        zipCode: "1000",
        country: "Tunisia",
      },
      contact: {
        phone: "+216 71 123 456",
        email: "contact@grandpalace.tn",
      },
      capacity: { min: 50, max: 500 },
      pricing: { basePrice: 5000 },
      amenities: [
        "Parking",
        "AC",
        "WiFi",
        "Kitchen",
        "Sound System",
        "Projector",
      ],
      operatingHours: {
        monday: { open: "09:00", close: "23:00", closed: false },
        tuesday: { open: "09:00", close: "23:00", closed: false },
        wednesday: { open: "09:00", close: "23:00", closed: false },
        thursday: { open: "09:00", close: "23:00", closed: false },
        friday: { open: "09:00", close: "00:00", closed: false },
        saturday: { open: "09:00", close: "00:00", closed: false },
        sunday: { open: "10:00", close: "22:00", closed: false },
      },
      subscription: {
        plan: "annual",
        status: "active",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2025-12-31"),
        amount: 5000,
      },
      isActive: true,
      timeZone: "Africa/Tunis",
    },
    {
      name: "Villa Rosa",
      description:
        "Elegant villa perfect for intimate weddings and celebrations",
      address: {
        street: "Rue de la Marsa",
        city: "La Marsa",
        state: "Tunis",
        zipCode: "2078",
        country: "Tunisia",
      },
      contact: {
        phone: "+216 71 789 012",
        email: "info@villarosa.tn",
      },
      capacity: { min: 20, max: 150 },
      pricing: { basePrice: 3500 },
      amenities: ["Garden", "Parking", "AC", "WiFi", "Catering Kitchen"],
      operatingHours: {
        monday: { open: "10:00", close: "22:00", closed: false },
        tuesday: { open: "10:00", close: "22:00", closed: false },
        wednesday: { open: "10:00", close: "22:00", closed: false },
        thursday: { open: "10:00", close: "22:00", closed: false },
        friday: { open: "10:00", close: "23:00", closed: false },
        saturday: { open: "10:00", close: "23:00", closed: false },
        sunday: { open: "10:00", close: "22:00", closed: false },
      },
      subscription: {
        plan: "monthly",
        status: "active",
        startDate: new Date("2024-06-01"),
        endDate: new Date("2025-06-01"),
        amount: 500,
      },
      isActive: true,
      timeZone: "Africa/Tunis",
    },
  ]);

  console.log(`✅ Created ${venues.length} venues`);
  return venues;
};

// =========================================================
// SEED ROLES
// =========================================================

const seedRoles = async (venue, permissions) => {
  console.log("\n👥 Seeding roles...");

  const allPermissionIds = permissions.map((p) => p._id);

  const managerPermissions = permissions
    .filter((p) => !p.name.includes("manage") && !p.name.includes("delete"))
    .map((p) => p._id);

  const staffPermissions = permissions
    .filter(
      (p) =>
        p.action === "read" || p.action === "create" || p.name.includes("tasks")
    )
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
      description: "Can manage events, clients, and day-to-day operations",
      venueId: venue._id,
      isSystemRole: true,
      permissions: managerPermissions,
      level: 75,
    },
    {
      name: "Staff",
      description: "Can view and create basic records",
      venueId: venue._id,
      isSystemRole: true,
      permissions: staffPermissions,
      level: 50,
    },
    {
      name: "Viewer",
      description: "Read-only access",
      venueId: venue._id,
      isSystemRole: true,
      permissions: permissions
        .filter((p) => p.action === "read")
        .map((p) => p._id),
      level: 25,
    },
  ]);

  console.log(`✅ Created ${roles.length} roles`);
  return roles;
};

// =========================================================
// SEED USERS
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
      phone: "+216 98 123 456",
      roleId: ownerRole._id,
      roleType: "owner",
      venueId: venue._id,
      isActive: true,
    },
    {
      name: "Fatima Ben Ali",
      email: "manager@demo.com",
      password: "password123",
      phone: "+216 98 234 567",
      roleId: managerRole._id,
      roleType: "manager",
      venueId: venue._id,
      isActive: true,
    },
    {
      name: "Mohamed Trabelsi",
      email: "staff@demo.com",
      password: "password123",
      phone: "+216 98 345 678",
      roleId: staffRole._id,
      roleType: "staff",
      venueId: venue._id,
      isActive: true,
    },
  ]);

  // Update venue owner
  venue.owner = users[0]._id;
  await venue.save();

  console.log(`✅ Created ${users.length} users`);
  console.log(`📧 Demo accounts:`);
  console.log(`   Owner: owner@demo.com / password123`);
  console.log(`   Manager: manager@demo.com / password123`);
  console.log(`   Staff: staff@demo.com / password123`);

  return users;
};

// =========================================================
// SEED VENUE SPACES
// =========================================================

const seedVenueSpaces = async (venue, owner) => {
  console.log("\n🏢 Seeding venue spaces...");

  const spaces = await VenueSpace.create([
    {
      name: "Grand Ballroom",
      description:
        "Our largest and most elegant space, perfect for weddings and large events",
      capacity: { min: 100, max: 500 },
      basePrice: 8000,
      turnoverTime: 120,
      amenities: [
        "Chandelier",
        "Stage",
        "Dance Floor",
        "Premium Sound System",
        "LED Lighting",
      ],
      operatingHours: {
        monday: { open: "09:00", close: "23:00", closed: false },
        tuesday: { open: "09:00", close: "23:00", closed: false },
        wednesday: { open: "09:00", close: "23:00", closed: false },
        thursday: { open: "09:00", close: "23:00", closed: false },
        friday: { open: "09:00", close: "00:00", closed: false },
        saturday: { open: "09:00", close: "00:00", closed: false },
        sunday: { open: "10:00", close: "22:00", closed: false },
      },
      venueId: venue._id,
      owner: owner._id,
      isActive: true,
      timeZone: "Africa/Tunis",
    },
    {
      name: "Garden Terrace",
      description: "Beautiful outdoor space with panoramic views",
      capacity: { min: 50, max: 200 },
      basePrice: 5000,
      turnoverTime: 90,
      amenities: [
        "Outdoor Setting",
        "Garden",
        "Fountain",
        "String Lights",
        "Covered Area",
      ],
      operatingHours: {
        monday: { open: "10:00", close: "22:00", closed: false },
        tuesday: { open: "10:00", close: "22:00", closed: false },
        wednesday: { open: "10:00", close: "22:00", closed: false },
        thursday: { open: "10:00", close: "22:00", closed: false },
        friday: { open: "10:00", close: "23:00", closed: false },
        saturday: { open: "10:00", close: "23:00", closed: false },
        sunday: { open: "10:00", close: "22:00", closed: false },
      },
      venueId: venue._id,
      owner: owner._id,
      isActive: true,
      timeZone: "Africa/Tunis",
    },
    {
      name: "Intimate Salon",
      description:
        "Cozy space ideal for small gatherings and corporate meetings",
      capacity: { min: 20, max: 80 },
      basePrice: 2500,
      turnoverTime: 60,
      amenities: ["AC", "Projector", "Whiteboard", "Coffee Station", "WiFi"],
      operatingHours: {
        monday: { open: "08:00", close: "20:00", closed: false },
        tuesday: { open: "08:00", close: "20:00", closed: false },
        wednesday: { open: "08:00", close: "20:00", closed: false },
        thursday: { open: "08:00", close: "20:00", closed: false },
        friday: { open: "08:00", close: "20:00", closed: false },
        saturday: { open: "10:00", close: "18:00", closed: false },
        sunday: { open: "10:00", close: "18:00", closed: true },
      },
      venueId: venue._id,
      owner: owner._id,
      isActive: true,
      timeZone: "Africa/Tunis",
    },
  ]);

  console.log(`✅ Created ${spaces.length} venue spaces`);
  return spaces;
};

// =========================================================
// SEED CLIENTS
// =========================================================

const seedClients = async (venue, createdBy) => {
  console.log("\n👥 Seeding clients...");

  const clients = await Client.create([
    {
      name: "Sarah & Karim Wedding",
      email: "sarah.karim@email.com",
      phone: "+216 98 111 222",
      venueId: venue._id,
      status: "active",
      company: "Personal",
      address: {
        street: "15 Rue de Carthage",
        city: "Tunis",
        zipCode: "1000",
        country: "Tunisia",
      },
      notes: "Looking for premium wedding package. Bride allergic to nuts. Budget: 25,000 TND",
      tags: ["wedding", "vip", "2025", "premium"],
      createdBy: createdBy._id,
    },
    {
      name: "TechCorp Tunisia",
      email: "events@techcorp.tn",
      phone: "+216 71 333 444",
      venueId: venue._id,
      status: "active",
      company: "TechCorp Tunisia",
      address: {
        street: "Centre Urbain Nord",
        city: "Tunis",
        zipCode: "1082",
        country: "Tunisia",
      },
      notes: "Corporate client, annual gala event. Recurring customer. CEO: Ahmed Mansour",
      tags: ["corporate", "recurring", "tech", "vip"],
      createdBy: createdBy._id,
    },
    {
      name: "Leila Ben Mahmoud",
      email: "leila.benmahmoud@email.com",
      phone: "+216 98 555 666",
      venueId: venue._id,
      status: "active",
      address: {
        street: "La Marsa",
        city: "Tunis",
        zipCode: "2078",
        country: "Tunisia",
      },
      notes: "50th birthday celebration. Prefers garden setting.",
      tags: ["birthday", "family", "garden"],
      createdBy: createdBy._id,
    },
    {
      name: "Startup Hub",
      email: "contact@startuphub.tn",
      phone: "+216 71 777 888",
      venueId: venue._id,
      status: "active",
      company: "Startup Hub",
      address: {
        street: "Lac 2",
        city: "Tunis",
        zipCode: "1053",
        country: "Tunisia",
      },
      notes: "Monthly networking events. Budget-conscious but consistent.",
      tags: ["corporate", "recurring", "networking", "budget"],
      createdBy: createdBy._id,
    },
    {
      name: "Amira & Youssef Engagement",
      email: "amira.youssef@email.com",
      phone: "+216 98 222 333",
      venueId: venue._id,
      status: "active",
      address: {
        street: "Sidi Bou Said",
        city: "Tunis",
        zipCode: "2026",
        country: "Tunisia",
      },
      notes: "Traditional engagement party. 200 guests expected.",
      tags: ["engagement", "traditional", "family"],
      createdBy: createdBy._id,
    },
    {
      name: "Medical Conference Organizers",
      email: "info@medconf.tn",
      phone: "+216 71 444 555",
      venueId: venue._id,
      status: "active",
      company: "Medical Conference TN",
      notes: "Annual medical conference. Need AV equipment and catering.",
      tags: ["corporate", "conference", "recurring"],
      createdBy: createdBy._id,
    },
    {
      name: "Rania Graduation Party",
      email: "rania.grad@email.com",
      phone: "+216 98 666 777",
      venueId: venue._id,
      status: "active",
      notes: "University graduation celebration. Young crowd, need DJ.",
      tags: ["graduation", "young", "party"],
      createdBy: createdBy._id,
    },
    {
      name: "Embassy of France",
      email: "events@ambafrance-tn.org",
      phone: "+216 71 888 999",
      venueId: venue._id,
      status: "active",
      company: "French Embassy",
      notes: "Diplomatic reception. High security requirements.",
      tags: ["diplomatic", "vip", "security", "recurring"],
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${clients.length} clients`);
  return clients;
};


// =========================================================
// SEED PARTNERS
// =========================================================

const seedPartners = async (venue, createdBy) => {
  console.log("\n🤝 Seeding partners...");

  const partners = await Partner.create([
    // Catering
    {
      name: "Elite Catering Services",
      email: "contact@elitecatering.tn",
      phone: "+216 71 111 222",
      venueId: venue._id,
      category: "catering",
      company: "Elite Catering SARL",
      status: "active",
      priceType: "fixed",
      fixedRate: 45,
      rating: 4.8,
      totalJobs: 127,
      specialties: "Tunisian & Mediterranean cuisine, Wedding menus, Halal certified",
      location: "Tunis",
      notes: "Preferred vendor, excellent quality. 10% discount for events over 200 guests",
      createdBy: createdBy._id,
    },
    {
      name: "Royal Feast Catering",
      email: "info@royalfeast.tn",
      phone: "+216 71 222 333",
      venueId: venue._id,
      category: "catering",
      company: "Royal Feast",
      status: "active",
      priceType: "fixed",
      fixedRate: 55,
      rating: 4.9,
      totalJobs: 84,
      specialties: "Premium French cuisine, Molecular gastronomy, Vegan options",
      location: "La Marsa",
      notes: "High-end caterer for luxury events",
      createdBy: createdBy._id,
    },

    // Photography
    {
      name: "Studio Lumière",
      email: "booking@studiolumiere.tn",
      phone: "+216 98 222 333",
      venueId: venue._id,
      category: "photography",
      company: "Studio Lumière",
      status: "active",
      priceType: "hourly",
      hourlyRate: 150,
      rating: 4.9,
      totalJobs: 89,
      specialties: "Wedding photography, Videography, Drone shots, Same-day edits",
      location: "Carthage",
      notes: "Award-winning photographer. Requires 50% deposit.",
      createdBy: createdBy._id,
    },
    {
      name: "Moments Photography",
      email: "info@moments.tn",
      phone: "+216 98 333 444",
      venueId: venue._id,
      category: "photography",
      company: "Moments Studio",
      status: "active",
      priceType: "fixed",
      fixedRate: 1200,
      rating: 4.7,
      totalJobs: 156,
      specialties: "Candid photography, Photo booths, Instant prints",
      location: "Tunis",
      createdBy: createdBy._id,
    },

    // Decoration
    {
      name: "Décor Dreams",
      email: "info@decordreams.tn",
      phone: "+216 98 444 555",
      venueId: venue._id,
      category: "decoration",
      company: "Décor Dreams",
      status: "active",
      priceType: "fixed",
      fixedRate: 2500,
      rating: 4.7,
      totalJobs: 156,
      specialties: "Floral arrangements, Lighting design, Custom themes, Balloon art",
      location: "La Marsa",
      notes: "Can source rare flowers with 2 weeks notice",
      createdBy: createdBy._id,
    },

    // Music/DJ
    {
      name: "DJ Soundwaves",
      email: "dj@soundwaves.tn",
      phone: "+216 98 555 666",
      venueId: venue._id,
      category: "music",
      company: "Soundwaves Entertainment",
      status: "active",
      priceType: "hourly",
      hourlyRate: 200,
      rating: 4.8,
      totalJobs: 203,
      specialties: "Weddings, Corporate events, Live mixing, MC services",
      location: "Tunis",
      notes: "Owns premium sound equipment. Very popular on weekends.",
      createdBy: createdBy._id,
    },
    {
      name: "Live Music Ensemble",
      email: "booking@livemusic.tn",
      phone: "+216 98 666 777",
      venueId: venue._id,
      category: "music",
      company: "Live Music TN",
      status: "active",
      priceType: "fixed",
      fixedRate: 3000,
      rating: 4.9,
      totalJobs: 67,
      specialties: "Live band, Jazz, Classical, Arabic traditional music",
      location: "Sidi Bou Said",
      notes: "5-piece band, requires stage space",
      createdBy: createdBy._id,
    },

    // Security
    {
      name: "Safe & Secure",
      email: "ops@safeandsecure.tn",
      phone: "+216 71 555 666",
      venueId: venue._id,
      category: "security",
      company: "Safe & Secure SARL",
      status: "active",
      priceType: "hourly",
      hourlyRate: 35,
      rating: 4.6,
      totalJobs: 94,
      specialties: "Event security, Crowd management, VIP protection",
      location: "Tunis",
      notes: "Licensed and insured. Minimum 4 guards per event.",
      createdBy: createdBy._id,
    },

    // Drivers
    {
      name: "Premium Transport Services",
      email: "bookings@premiumtransport.tn",
      phone: "+216 71 666 777",
      venueId: venue._id,
      category: "driver",
      company: "Premium Transport",
      status: "active",
      priceType: "hourly",
      hourlyRate: 50,
      rating: 4.8,
      totalJobs: 145,
      specialties: "Luxury vehicles, Wedding cars, Airport transfers",
      location: "Tunis",
      createdBy: createdBy._id,
    },

    // Bakery
    {
      name: "La Pâtisserie Royale",
      email: "orders@patisserieroyale.tn",
      phone: "+216 71 777 888",
      venueId: venue._id,
      category: "bakery",
      company: "La Pâtisserie Royale",
      status: "active",
      priceType: "fixed",
      fixedRate: 800,
      rating: 4.9,
      totalJobs: 234,
      specialties: "Wedding cakes, French pastries, Custom designs, Gluten-free options",
      location: "La Marsa",
      notes: "Requires 2 weeks notice for custom cakes. Award-winning.",
      createdBy: createdBy._id,
    },

    // Cleaning
    {
      name: "Sparkle Clean Pro",
      email: "info@sparkleclean.tn",
      phone: "+216 71 888 999",
      venueId: venue._id,
      category: "cleaning",
      company: "Sparkle Clean",
      status: "active",
      priceType: "fixed",
      fixedRate: 400,
      rating: 4.5,
      totalJobs: 312,
      specialties: "Post-event cleaning, Deep cleaning, Carpet shampooing",
      location: "Tunis",
      notes: "Available 24/7 for emergency cleaning",
      createdBy: createdBy._id,
    },

    // Hair & Makeup
    {
      name: "Glamour Beauty Studio",
      email: "bookings@glamourbeauty.tn",
      phone: "+216 98 777 888",
      venueId: venue._id,
      category: "hairstyling",
      company: "Glamour Beauty",
      status: "active",
      priceType: "fixed",
      fixedRate: 250,
      rating: 4.8,
      totalJobs: 178,
      specialties: "Bridal makeup, Hairstyling, Airbrush makeup, Trial sessions",
      location: "Tunis",
      notes: "Can provide on-site services with advance booking",
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${partners.length} partners`);
  return partners;
};
// =========================================================
// SEED SUPPLY CATEGORIES & SUPPLIES
// =========================================================

const seedSupplies = async (venue, createdBy) => {
  console.log("\n📦 Seeding supply categories and supplies...");

  // Initialize default categories
  const categories = await SupplyCategory.initializeDefaults(
    venue._id,
    createdBy._id
  );
  console.log(`✅ Created ${categories.length} supply categories`);

  // Get specific categories
  const beveragesCat = categories.find((c) => c.name === "Beverages");
  const snacksCat = categories.find((c) => c.name === "Snacks");
  const foodCat = categories.find((c) => c.name === "Food");
  const decorCat = categories.find((c) => c.name === "Decoration");
  const tablewareCat = categories.find((c) => c.name === "Tableware");
  const linenCat = categories.find((c) => c.name === "Linen");
  const equipmentCat = categories.find((c) => c.name === "Equipment");

  // Create supplies
  const supplies = await Supply.create([
    // Beverages
    {
      name: "Orange Juice (1L)",
      categoryId: beveragesCat._id,
      unit: "bottle",
      currentStock: 150,
      minimumStock: 30,
      maximumStock: 300,
      costPerUnit: 4.5,
      pricingType: "included",
      chargePerUnit: 0,
      supplier: {
        name: "Fresh Juice Co.",
        phone: "+216 71 111 111",
        leadTimeDays: 3,
      },
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Mineral Water (1.5L)",
      categoryId: beveragesCat._id,
      unit: "bottle",
      currentStock: 200,
      minimumStock: 50,
      maximumStock: 500,
      costPerUnit: 1.2,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Soft Drinks (330ml)",
      categoryId: beveragesCat._id,
      unit: "can",
      currentStock: 180,
      minimumStock: 50,
      maximumStock: 400,
      costPerUnit: 1.8,
      pricingType: "chargeable",
      chargePerUnit: 3.5,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // Snacks
    {
      name: "Mixed Nuts Premium",
      categoryId: snacksCat._id,
      unit: "kg",
      currentStock: 25,
      minimumStock: 10,
      maximumStock: 100,
      costPerUnit: 35,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Gourmet Cookies",
      categoryId: snacksCat._id,
      unit: "pack",
      currentStock: 40,
      minimumStock: 15,
      maximumStock: 120,
      costPerUnit: 12,
      pricingType: "chargeable",
      chargePerUnit: 25,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // Food
    {
      name: "Canapés Assortment",
      categoryId: foodCat._id,
      unit: "serving",
      currentStock: 0,
      minimumStock: 0,
      maximumStock: 1000,
      costPerUnit: 8,
      pricingType: "chargeable",
      chargePerUnit: 15,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
      notes: "Order fresh per event",
    },

    // Decoration
    {
      name: "Rose Centerpieces",
      categoryId: decorCat._id,
      unit: "piece",
      currentStock: 30,
      minimumStock: 10,
      maximumStock: 80,
      costPerUnit: 25,
      pricingType: "chargeable",
      chargePerUnit: 50,
      storage: {
        location: "Refrigerator",
        requiresRefrigeration: true,
        expiryTracking: true,
        shelfLife: 3,
      },
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "LED String Lights (10m)",
      categoryId: decorCat._id,
      unit: "set",
      currentStock: 15,
      minimumStock: 5,
      maximumStock: 30,
      costPerUnit: 45,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Balloons (Pack of 50)",
      categoryId: decorCat._id,
      unit: "pack",
      currentStock: 20,
      minimumStock: 10,
      maximumStock: 60,
      costPerUnit: 15,
      pricingType: "chargeable",
      chargePerUnit: 30,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // Tableware
    {
      name: "Porcelain Dinner Plates",
      categoryId: tablewareCat._id,
      unit: "piece",
      currentStock: 500,
      minimumStock: 200,
      maximumStock: 800,
      costPerUnit: 3.5,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Crystal Wine Glasses",
      categoryId: tablewareCat._id,
      unit: "piece",
      currentStock: 400,
      minimumStock: 150,
      maximumStock: 600,
      costPerUnit: 4.2,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Premium Napkins",
      categoryId: tablewareCat._id,
      unit: "pack",
      currentStock: 80,
      minimumStock: 30,
      maximumStock: 200,
      costPerUnit: 8,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // Linen
    {
      name: "White Tablecloths (3m)",
      categoryId: linenCat._id,
      unit: "piece",
      currentStock: 100,
      minimumStock: 40,
      maximumStock: 200,
      costPerUnit: 15,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Satin Chair Covers",
      categoryId: linenCat._id,
      unit: "piece",
      currentStock: 250,
      minimumStock: 100,
      maximumStock: 500,
      costPerUnit: 5,
      pricingType: "chargeable",
      chargePerUnit: 12,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // Equipment
    {
      name: "Banquet Chairs",
      categoryId: equipmentCat._id,
      unit: "piece",
      currentStock: 300,
      minimumStock: 200,
      maximumStock: 500,
      costPerUnit: 0,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      name: "Round Tables (8 seater)",
      categoryId: equipmentCat._id,
      unit: "piece",
      currentStock: 50,
      minimumStock: 30,
      maximumStock: 80,
      costPerUnit: 0,
      pricingType: "included",
      chargePerUnit: 0,
      status: "active",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${supplies.length} supplies`);
  return { categories, supplies };
};

// =========================================================
// SEED EVENTS
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

  const [ballroom, garden, salon] = spaces;
  const [weddingClient, corpClient, birthdayClient, startupClient] = clients;
  const [catering, photography, decoration, dj, security] = partners;

  // Get specific supplies for allocation
  const orangeJuice = supplies.find((s) => s.name.includes("Orange Juice"));
  const water = supplies.find((s) => s.name.includes("Mineral Water"));
  const plates = supplies.find((s) => s.name.includes("Dinner Plates"));
  const glasses = supplies.find((s) => s.name.includes("Wine Glasses"));
  const tablecloths = supplies.find((s) => s.name.includes("Tablecloths"));
  const chairs = supplies.find((s) => s.name.includes("Banquet Chairs"));
  const tables = supplies.find((s) => s.name.includes("Round Tables"));
  const centerpieces = supplies.find((s) =>
    s.name.includes("Rose Centerpieces")
  );

  const events = await Event.create([
    {
      title: "Sarah & Karim Wedding Reception",
      type: "wedding",
      status: "confirmed",
      clientId: weddingClient._id,
      venueId: venue._id,
      venueSpaceId: ballroom._id,
      startDate: generateFutureDate(45),
      endDate: generateFutureDate(45),
      startTime: "18:00",
      endTime: "23:30",
      guestCount: 350,
      notes: "Premium wedding package. Bride allergic to nuts.",
      partners: [
        {
          partner: catering._id,
          service: "Full catering service with premium menu",
          cost: 15750,
          status: "confirmed",
        },
        {
          partner: photography._id,
          service: "Photography & Videography (8 hours)",
          cost: 1200,
          hours: 8,
          status: "confirmed",
        },
        {
          partner: decoration._id,
          service: "Premium floral decoration & lighting",
          cost: 3500,
          status: "confirmed",
        },
        {
          partner: dj._id,
          service: "DJ & Sound system (6 hours)",
          cost: 1200,
          hours: 6,
          status: "confirmed",
        },
      ],
      pricing: {
        basePrice: 8000,
        additionalServices: [
          { name: "Premium Sound System", price: 500 },
          { name: "Extended Hours", price: 1000 },
        ],
        discount: 0,
        taxRate: 19,
      },
      supplies: [
        {
          supply: orangeJuice._id,
          supplyName: orangeJuice.name,
          supplyCategoryId: orangeJuice.categoryId,
          supplyUnit: orangeJuice.unit,
          quantityRequested: 80,
          quantityAllocated: 80,
          costPerUnit: orangeJuice.costPerUnit,
          chargePerUnit: orangeJuice.chargePerUnit,
          pricingType: orangeJuice.pricingType,
          totalCost: 80 * orangeJuice.costPerUnit,
          totalCharge: 0,
          status: "allocated",
          allocatedAt: new Date(),
        },
        {
          supply: water._id,
          supplyName: water.name,
          supplyCategoryId: water.categoryId,
          supplyUnit: water.unit,
          quantityRequested: 100,
          quantityAllocated: 100,
          costPerUnit: water.costPerUnit,
          chargePerUnit: water.chargePerUnit,
          pricingType: water.pricingType,
          totalCost: 100 * water.costPerUnit,
          totalCharge: 0,
          status: "allocated",
          allocatedAt: new Date(),
        },
        {
          supply: plates._id,
          supplyName: plates.name,
          supplyCategoryId: plates.categoryId,
          supplyUnit: plates.unit,
          quantityRequested: 350,
          quantityAllocated: 350,
          costPerUnit: plates.costPerUnit,
          chargePerUnit: plates.chargePerUnit,
          pricingType: plates.pricingType,
          totalCost: 350 * plates.costPerUnit,
          totalCharge: 0,
          status: "allocated",
          allocatedAt: new Date(),
        },
        {
          supply: centerpieces._id,
          supplyName: centerpieces.name,
          supplyCategoryId: centerpieces.categoryId,
          supplyUnit: centerpieces.unit,
          quantityRequested: 25,
          quantityAllocated: 25,
          costPerUnit: centerpieces.costPerUnit,
          chargePerUnit: centerpieces.chargePerUnit,
          pricingType: centerpieces.pricingType,
          totalCost: 25 * centerpieces.costPerUnit,
          totalCharge: 25 * centerpieces.chargePerUnit,
          status: "allocated",
          allocatedAt: new Date(),
        },
      ],
      createdBy: createdBy._id,
    },
    {
      title: "TechCorp Annual Gala 2025",
      type: "corporate",
      status: "confirmed",
      clientId: corpClient._id,
      venueId: venue._id,
      venueSpaceId: ballroom._id,
      startDate: generateFutureDate(90),
      endDate: generateFutureDate(90),
      startTime: "19:00",
      endTime: "23:00",
      guestCount: 250,
      notes: "Corporate gala event. Need invoice for company",
      partners: [
        {
          partner: catering._id,
          service: "Corporate buffet menu",
          cost: 11250,
          status: "confirmed",
        },
        {
          partner: dj._id,
          service: "Background music & presentation support",
          cost: 800,
          hours: 4,
          status: "confirmed",
        },
      ],
      pricing: {
        basePrice: 8000,
        additionalServices: [
          { name: "Projector & Screen", price: 300 },
          { name: "Stage Setup", price: 500 },
        ],
        discount: 800,
        taxRate: 19,
      },
      supplies: [
        {
          supply: water._id,
          supplyName: water.name,
          supplyCategoryId: water.categoryId,
          supplyUnit: water.unit,
          quantityRequested: 80,
          quantityAllocated: 80,
          costPerUnit: water.costPerUnit,
          chargePerUnit: water.chargePerUnit,
          pricingType: water.pricingType,
          totalCost: 80 * water.costPerUnit,
          totalCharge: 0,
          status: "allocated",
          allocatedAt: new Date(),
        },
      ],
      createdBy: createdBy._id,
    },
    {
      title: "Leila's 50th Birthday Celebration",
      type: "birthday",
      status: "pending",
      clientId: birthdayClient._id,
      venueId: venue._id,
      venueSpaceId: garden._id,
      startDate: generateFutureDate(30),
      endDate: generateFutureDate(30),
      startTime: "17:00",
      endTime: "22:00",
      guestCount: 120,
      notes: "Outdoor garden party theme",
      partners: [
        {
          partner: catering._id,
          service: "Cocktail party catering",
          cost: 5400,
          status: "pending",
        },
        {
          partner: decoration._id,
          service: "Garden party decoration",
          cost: 1800,
          status: "pending",
        },
      ],
      pricing: {
        basePrice: 5000,
        additionalServices: [{ name: "Birthday Cake Display", price: 150 }],
        discount: 0,
        taxRate: 19,
      },
      supplies: [],
      createdBy: createdBy._id,
    },
    {
      title: "Startup Networking Night",
      type: "corporate",
      status: "confirmed",
      clientId: startupClient._id,
      venueId: venue._id,
      venueSpaceId: salon._id,
      startDate: generateFutureDate(15),
      endDate: generateFutureDate(15),
      startTime: "18:30",
      endTime: "21:30",
      guestCount: 65,
      notes: "Monthly recurring event",
      partners: [],
      pricing: {
        basePrice: 2500,
        additionalServices: [{ name: "Coffee & Snacks", price: 400 }],
        discount: 200,
        taxRate: 19,
      },
      supplies: [],
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${events.length} events`);
  return events;
};

// =========================================================
// SEED PAYMENTS
// =========================================================

const seedPayments = async (venue, events, clients, createdBy) => {
  console.log("\n💰 Seeding payments...");

  const payments = await Payment.create([
    {
      event: events[0]._id,
      client: events[0].clientId,
      type: "income",
      amount: 5000,
      method: "bank_transfer",
      status: "completed",
      reference: "DEP-2025-001",
      description: "Wedding deposit - 50%",
      paidDate: new Date(),
      venueId: venue._id,
      processedBy: createdBy._id,
    },
    {
      event: events[1]._id,
      client: events[1].clientId,
      type: "income",
      amount: 8000,
      method: "bank_transfer",
      status: "completed",
      reference: "INV-CORP-2025",
      description: "Corporate gala full payment",
      paidDate: new Date(),
      venueId: venue._id,
      processedBy: createdBy._id,
    },
    {
      event: events[2]._id,
      client: events[2].clientId,
      type: "income",
      amount: 2000,
      method: "cash",
      status: "completed",
      reference: "DEP-BDAY-001",
      description: "Birthday party deposit",
      paidDate: new Date(),
      venueId: venue._id,
      processedBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${payments.length} payments`);
  return payments;
};

// =========================================================
// SEED FINANCE RECORDS
// =========================================================

const seedFinance = async (venue, events, partners, createdBy) => {
  console.log("\n💵 Seeding finance records...");

  const finance = await Finance.create([
    {
      type: "income",
      category: "event_revenue",
      description: "Wedding reception booking - Sarah & Karim",
      amount: 5000,
      date: new Date(),
      paymentMethod: "bank_transfer",
      reference: "DEP-2025-001",
      relatedEvent: events[0]._id,
      status: "completed",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      type: "expense",
      category: "utilities",
      description: "Monthly electricity bill - December",
      amount: 850,
      date: new Date(),
      paymentMethod: "bank_transfer",
      reference: "ELEC-12-2024",
      status: "completed",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      type: "expense",
      category: "maintenance",
      description: "HVAC system maintenance",
      amount: 450,
      date: generateRandomDate(new Date(2024, 11, 1), new Date()),
      paymentMethod: "cash",
      status: "completed",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      type: "expense",
      category: "marketing",
      description: "Facebook Ads campaign - December",
      amount: 300,
      date: new Date(),
      paymentMethod: "card",
      reference: "META-ADS-DEC",
      status: "completed",
      venueId: venue._id,
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${finance.length} finance records`);
  return finance;
};

// =========================================================
// SEED TASKS
// =========================================================

const seedTasks = async (venue, events, users, createdBy) => {
  console.log("\n✅ Seeding tasks...");

  const [owner, manager, staff] = users;

  const tasks = await Task.create([
    {
      title: "Confirm catering menu with Elite Catering",
      description:
        "Review and finalize the menu for Sarah & Karim's wedding. Confirm nut-free options.",
      status: "in_progress",
      priority: "high",
      category: "event_preparation",
      dueDate: generateFutureDate(7),
      assignedTo: manager._id,
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Setup stage for TechCorp gala",
      description: "Install stage, projector, and presentation equipment",
      status: "todo",
      priority: "medium",
      category: "setup",
      dueDate: generateFutureDate(88),
      assignedTo: staff._id,
      subtasks: [
        { title: "Position stage platform", completed: false },
        { title: "Connect projector and test", completed: false },
        { title: "Setup microphone system", completed: false },
        { title: "Run cable management", completed: false },
      ],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Order additional chairs for wedding",
      description: "Current inventory might not be sufficient for 350 guests",
      status: "pending",
      priority: "urgent",
      category: "event_preparation",
      dueDate: generateFutureDate(5),
      assignedTo: manager._id,
      tags: ["urgent", "inventory"],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Update venue photos on website",
      description: "New professional photos need to be uploaded",
      status: "todo",
      priority: "low",
      category: "marketing",
      dueDate: generateFutureDate(20),
      assignedTo: manager._id,
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Monthly safety inspection",
      description:
        "Check fire extinguishers, emergency exits, and first aid kits",
      status: "completed",
      priority: "high",
      category: "maintenance",
      dueDate: new Date(),
      assignedTo: staff._id,
      venueId: venue._id,
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${tasks.length} tasks`);
  return tasks;
};

// =========================================================
// SEED REMINDERS
// =========================================================
const seedReminders = async (venue, events, users, createdBy) => {
  console.log("\n🔔 Seeding reminders...");

  const [owner, manager, staff] = users;
  const now = new Date();

  // Helper to create date with specific time
  const createDateTime = (daysOffset, hours, minutes) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Helper to format time
  const formatTime = (hours, minutes) => {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const reminders = await Reminder.create([
    // ==========================================
    // OVERDUE REMINDERS (Testing urgent alerts)
    // ==========================================
    {
      title: "⚠️ URGENT: Final payment confirmation needed",
      description: "Client hasn't confirmed final payment method. Event is in 2 days!",
      type: "payment",
      priority: "urgent",
      reminderDate: createDateTime(-2, 10, 0),
      reminderTime: formatTime(10, 0),
      status: "active",
      relatedEvent: events[0]._id,
      assignedTo: [manager._id, owner._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Follow up on catering menu changes",
      description: "Client requested menu modifications 3 days ago. Need confirmation.",
      type: "followup",
      priority: "high",
      reminderDate: createDateTime(-3, 14, 30),
      reminderTime: formatTime(14, 30),
      status: "active",
      relatedEvent: events[0]._id,
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Confirm decoration delivery",
      description: "Decorator needs to confirm delivery time for tomorrow's event",
      type: "event",
      priority: "high",
      reminderDate: createDateTime(-1, 9, 0),
      reminderTime: formatTime(9, 0),
      status: "active",
      relatedEvent: events[0]._id,
      assignedTo: [staff._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // IMMINENT REMINDERS (Next hour - Critical)
    // ==========================================
    {
      title: "🚨 Client arrival in 30 minutes",
      description: "VIP client arriving for venue tour. Prepare welcome package.",
      type: "other",
      priority: "urgent",
      reminderDate: now.toISOString().split('T')[0],
      reminderTime: formatTime(now.getHours(), now.getMinutes() + 30),
      status: "active",
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Team briefing for tonight's event",
      description: "Pre-event meeting with all staff members",
      type: "event",
      priority: "high",
      reminderDate: now.toISOString().split('T')[0],
      reminderTime: formatTime(now.getHours() + 1, 0),
      status: "active",
      assignedTo: [manager._id, staff._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // TODAY REMINDERS (Next 24 hours)
    // ==========================================
    {
      title: "Send invoice to TechCorp",
      description: "Generate and email invoice for upcoming corporate event",
      type: "payment",
      priority: "high",
      reminderDate: now.toISOString().split('T')[0],
      reminderTime: formatTime(16, 0),
      status: "active",
      relatedEvent: events[1]._id,
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Check inventory for weekend events",
      description: "Verify we have sufficient chairs, tables, and linens",
      type: "task",
      priority: "medium",
      reminderDate: now.toISOString().split('T')[0],
      reminderTime: formatTime(17, 30),
      status: "active",
      assignedTo: [staff._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Call photographer for final details",
      description: "Confirm arrival time and special shot list with photographer",
      type: "event",
      priority: "medium",
      reminderDate: now.toISOString().split('T')[0],
      reminderTime: formatTime(19, 0),
      status: "active",
      relatedEvent: events[0]._id,
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // TOMORROW REMINDERS
    // ==========================================
    {
      title: "Venue walkthrough with wedding couple",
      description: "Final venue inspection with Sarah & Karim before the big day",
      type: "event",
      priority: "high",
      reminderDate: createDateTime(1, 10, 0),
      reminderTime: formatTime(10, 0),
      status: "active",
      relatedEvent: events[0]._id,
      assignedTo: [manager._id, staff._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Submit monthly expense report",
      description: "Compile and submit December expense report to accounting",
      type: "other",
      priority: "medium",
      reminderDate: createDateTime(1, 14, 0),
      reminderTime: formatTime(14, 0),
      status: "active",
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Order fresh flowers for weekend events",
      description: "Place order with florist for Saturday and Sunday events",
      type: "task",
      priority: "medium",
      reminderDate: createDateTime(1, 11, 30),
      reminderTime: formatTime(11, 30),
      status: "active",
      assignedTo: [staff._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // THIS WEEK REMINDERS (2-7 days)
    // ==========================================
    {
      title: "Follow up with birthday party client",
      description: "Check if Leila has finalized guest count and menu preferences",
      type: "followup",
      priority: "medium",
      reminderDate: createDateTime(3, 10, 0),
      reminderTime: formatTime(10, 0),
      status: "active",
      relatedEvent: events[2]._id,
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Quarterly HVAC maintenance",
      description: "Schedule technician for air conditioning system inspection",
      type: "maintenance",
      priority: "medium",
      reminderDate: createDateTime(4, 8, 0),
      reminderTime: formatTime(8, 0),
      status: "active",
      assignedTo: [owner._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Review and approve marketing materials",
      description: "New promotional flyers ready for review",
      type: "other",
      priority: "low",
      reminderDate: createDateTime(5, 15, 0),
      reminderTime: formatTime(15, 0),
      status: "active",
      assignedTo: [owner._id, manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Staff training session on new booking system",
      description: "Mandatory training for all team members on updated software",
      type: "other",
      priority: "medium",
      reminderDate: createDateTime(6, 9, 30),
      reminderTime: formatTime(9, 30),
      status: "active",
      assignedTo: [manager._id, staff._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // NEXT WEEK REMINDERS (8-14 days)
    // ==========================================
    {
      title: "Confirm DJ equipment setup for corporate gala",
      description: "Verify sound system requirements and setup time with DJ Soundwaves",
      type: "event",
      priority: "medium",
      reminderDate: createDateTime(10, 11, 0),
      reminderTime: formatTime(11, 0),
      status: "active",
      relatedEvent: events[1]._id,
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Renew venue insurance policy",
      description: "Annual insurance renewal deadline approaching",
      type: "other",
      priority: "high",
      reminderDate: createDateTime(12, 10, 0),
      reminderTime: formatTime(10, 0),
      status: "active",
      assignedTo: [owner._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Schedule deep cleaning of Grand Ballroom",
      description: "Post-event deep clean and carpet shampooing needed",
      type: "maintenance",
      priority: "medium",
      reminderDate: createDateTime(13, 8, 0),
      reminderTime: formatTime(8, 0),
      status: "active",
      assignedTo: [staff._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // LATER THIS MONTH (15-30 days)
    // ==========================================
    {
      title: "Prepare year-end financial report",
      description: "Compile Q4 revenue, expenses, and profit/loss statements",
      type: "other",
      priority: "high",
      reminderDate: createDateTime(20, 9, 0),
      reminderTime: formatTime(9, 0),
      status: "active",
      assignedTo: [owner._id, manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Order supplies for holiday events",
      description: "Stock up on decorations and supplies for New Year celebrations",
      type: "task",
      priority: "medium",
      reminderDate: createDateTime(25, 10, 0),
      reminderTime: formatTime(10, 0),
      status: "active",
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "Network maintenance window",
      description: "IT vendor scheduled for router and network equipment updates",
      type: "maintenance",
      priority: "low",
      reminderDate: createDateTime(28, 22, 0),
      reminderTime: formatTime(22, 0),
      status: "active",
      assignedTo: [owner._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // COMPLETED REMINDERS (for testing history)
    // ==========================================
    {
      title: "✅ Monthly safety inspection completed",
      description: "Fire extinguishers checked, emergency exits cleared, first aid kits restocked",
      type: "maintenance",
      priority: "high",
      reminderDate: createDateTime(-5, 8, 0),
      reminderTime: formatTime(8, 0),
      status: "completed",
      assignedTo: [staff._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "✅ Sent contract to wedding clients",
      description: "Wedding contract sent via email with electronic signature link",
      type: "followup",
      priority: "high",
      reminderDate: createDateTime(-7, 14, 0),
      reminderTime: formatTime(14, 0),
      status: "completed",
      relatedEvent: events[0]._id,
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
    {
      title: "✅ Updated website event gallery",
      description: "Uploaded professional photos from last weekend's events",
      type: "other",
      priority: "medium",
      reminderDate: createDateTime(-10, 16, 0),
      reminderTime: formatTime(16, 0),
      status: "completed",
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // SNOOZED REMINDERS (for testing snooze)
    // ==========================================
    {
      title: "Review catering contract renewal",
      description: "Negotiate new rates with Elite Catering for next year",
      type: "other",
      priority: "medium",
      reminderDate: createDateTime(2, 13, 0),
      reminderTime: formatTime(13, 0),
      status: "active",
      snoozeHistory: [
        {
          snoozedAt: createDateTime(-2, 13, 0),
          snoozeMinutes: 2880, // 2 days
          snoozedBy: manager._id,
        },
        {
          snoozedAt: createDateTime(0, 13, 0),
          snoozeMinutes: 2880, // 2 days
          snoozedBy: manager._id,
        },
      ],
      assignedTo: [manager._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },

    // ==========================================
    // DISMISSED REMINDER (for testing dismiss)
    // ==========================================
    {
      title: "Consider adding valet parking service",
      description: "Research valet parking vendors for premium events",
      type: "other",
      priority: "low",
      reminderDate: createDateTime(-1, 10, 0),
      reminderTime: formatTime(10, 0),
      status: "active",
      dismissed: true,
      dismissedAt: createDateTime(0, 11, 0),
      dismissedBy: owner._id,
      assignedTo: [owner._id],
      venueId: venue._id,
      createdBy: createdBy._id,
    },
  ]);

  console.log(`✅ Created ${reminders.length} reminders`);
  console.log(`   • ${reminders.filter(r => r.status === 'active' && new Date(r.reminderDate) < now).length} Overdue`);
  console.log(`   • ${reminders.filter(r => r.status === 'active' && new Date(r.reminderDate).toDateString() === now.toDateString()).length} Due Today`);
  console.log(`   • ${reminders.filter(r => r.status === 'completed').length} Completed`);
  console.log(`   • ${reminders.filter(r => r.snoozeHistory && r.snoozeHistory.length > 0).length} With Snooze History`);
  console.log(`   • ${reminders.filter(r => r.dismissed).length} Dismissed`);
  
  return reminders;
};


// =========================================================
// SEED INVOICES
// =========================================================

const seedInvoices = async (venue, events, clients, createdBy) => {
  console.log("\n📄 Seeding invoices...");

  // Create invoice settings first
  const invoiceSettings = await InvoiceSettings.getOrCreate(venue._id);

  // Define the data array first
  const invoiceData = [
    {
      venue: venue._id,
      invoiceType: "client",
      status: "sent",
      client: events[0].clientId,
      event: events[0]._id,
      recipientName: "Sarah & Karim",
      recipientEmail: "sarah.karim@email.com",
      recipientPhone: "+216 98 111 222",
      issueDate: new Date(),
      dueDate: generateFutureDate(30),
      currency: "TND",
      items: [
        {
          description: "Grand Ballroom Rental",
          quantity: 1,
          rate: 8000,
          amount: 8000,
        },
        {
          description: "Premium Sound System",
          quantity: 1,
          rate: 500,
          amount: 500,
        },
        {
          description: "Extended Hours (2 hours)",
          quantity: 2,
          rate: 500,
          amount: 1000,
        },
      ],
      subtotal: 9500,
      taxRate: 19,
      taxAmount: 1805,
      discount: 0,
      totalAmount: 11305,
      paymentStatus: {
        amountPaid: 5000,
        amountDue: 6305,
      },
      notes: "Thank you for choosing Grand Palace Events for your special day!",
      terms:
        "Payment due 30 days before event date. 50% deposit required to confirm booking.",
      createdBy: createdBy._id,
      sentAt: new Date(),
    },
    {
      venue: venue._id,
      invoiceType: "client",
      status: "paid",
      client: events[1].clientId,
      event: events[1]._id,
      recipientName: "TechCorp Tunisia",
      recipientEmail: "events@techcorp.tn",
      recipientPhone: "+216 71 333 444",
      recipientCompany: "TechCorp Tunisia",
      issueDate: new Date(),
      dueDate: generateFutureDate(60),
      currency: "TND",
      items: [
        {
          description: "Grand Ballroom Rental - Corporate Event",
          quantity: 1,
          rate: 8000,
          amount: 8000,
        },
        {
          description: "Projector & Screen Setup",
          quantity: 1,
          rate: 300,
          amount: 300,
        },
        {
          description: "Stage Setup",
          quantity: 1,
          rate: 500,
          amount: 500,
        },
      ],
      subtotal: 8800,
      taxRate: 19,
      taxAmount: 1672,
      discount: 800,
      totalAmount: 9672,
      paymentStatus: {
        amountPaid: 9672,
        amountDue: 0,
        lastPaymentDate: new Date(),
      },
      notes: "Thank you for your business!",
      terms: "Net 30 days. Bank transfer preferred.",
      createdBy: createdBy._id,
      sentAt: new Date(),
    },
  ];

  // Create invoices sequentially to ensure correct invoiceNumber generation
  const invoices = [];
  for (const data of invoiceData) {
    const invoice = await Invoice.create(data);
    invoices.push(invoice);
  }

  console.log(`✅ Created ${invoices.length} invoices`);
  return invoices;
};

// =========================================================
// SEED CONTRACTS
// =========================================================

const seedContracts = async (venue, events, createdBy) => {
  console.log("\n📑 Seeding contracts...");

  // Create contract settings first
  const contractSettings = await ContractSettings.getOrCreate(venue._id);

  // Define data first
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
        name: "Sarah Ben Ali & Karim Trabelsi",
        identifier: "12345678",
        address: "15 Rue de Carthage, Tunis 1000",
        phone: "+216 98 111 222",
        email: "sarah.karim@email.com",
      },
      logistics: {
        startDate: events[0].startDate,
        endDate: events[0].endDate,
        checkInTime: "16:00",
        checkOutTime: "00:00",
      },
      financials: {
        currency: "TND",
        amountHT: 9500,
        vatRate: 19,
        taxAmount: 1805,
        stampDuty: 1.0,
        totalTTC: 11305,
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
        specialConditions:
          "Client agrees to vacate premises by midnight. Additional hour charges apply for overtime.",
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
        name: "TechCorp Tunisia SARL",
        identifier: "1234567/A/M/000",
        representative: "Mr. Ahmed Mansour, Gérant",
        address: "Centre Urbain Nord, Tunis 1082",
        phone: "+216 71 333 444",
        email: "events@techcorp.tn",
      },
      logistics: {
        startDate: events[1].startDate,
        endDate: events[1].endDate,
        checkInTime: "14:00",
        checkOutTime: "23:30",
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
        specialConditions:
          "Retenue à la source applicable (1.5%). Company will provide certificate.",
      },
      signatures: {
        venueSignedAt: new Date(),
        venueSignerIp: "192.168.1.1",
        clientSignedAt: new Date(),
        clientSignerIp: "192.168.1.100",
      },
    },
  ];

  // Loop through and create sequentially to ensure contractNumber generates correctly
  const contracts = [];
  for (const data of contractData) {
    const contract = await Contract.create(data);
    contracts.push(contract);
  }

  console.log(`✅ Created ${contracts.length} contracts`);
  return contracts;
};
// =========================================================
// MAIN SEED FUNCTION
// =========================================================

const seedDatabase = async () => {
  try {
    console.log("\n🌱 Starting database seed...\n");
    console.log("═".repeat(60));

    await connectDB();
    await clearDatabase();

    // Seed in order
    const permissions = await seedPermissions();
    const venues = await seedVenues();
    const primaryVenue = venues[0];

    const roles = await seedRoles(primaryVenue, permissions);
    const users = await seedUsers(primaryVenue, roles);
    const owner = users[0];

    const spaces = await seedVenueSpaces(primaryVenue, owner);
    const clients = await seedClients(primaryVenue, owner);
    const partners = await seedPartners(primaryVenue, owner);

    const { categories, supplies } = await seedSupplies(primaryVenue, owner);

    const events = await seedEvents(
      primaryVenue,
      spaces,
      clients,
      partners,
      supplies,
      owner
    );

    // Update supply stock to reflect allocated supplies
    console.log("\n📦 Updating supply inventory...");
    supplies.find((s) => s.name.includes("Orange Juice")).currentStock -= 80;
    supplies.find((s) => s.name.includes("Mineral Water")).currentStock -= 180;
    supplies.find((s) => s.name.includes("Dinner Plates")).currentStock -= 350;
    supplies.find((s) =>
      s.name.includes("Rose Centerpieces")
    ).currentStock -= 25;

    await Promise.all(supplies.map((s) => s.save()));
    console.log("✅ Supply inventory updated");

    const payments = await seedPayments(primaryVenue, events, clients, owner);
    const finance = await seedFinance(primaryVenue, events, partners, owner);
    const tasks = await seedTasks(primaryVenue, events, users, owner);
    const reminders = await seedReminders(primaryVenue, events, users, owner);
    const invoices = await seedInvoices(primaryVenue, events, clients, owner);
    const contracts = await seedContracts(primaryVenue, events, owner);

    console.log("\n" + "═".repeat(60));
    console.log("\n✅ DATABASE SEEDED SUCCESSFULLY!\n");
    console.log("📊 Summary:");
    console.log(`   • ${venues.length} Venues`);
    console.log(`   • ${spaces.length} Venue Spaces`);
    console.log(`   • ${users.length} Users`);
    console.log(`   • ${roles.length} Roles`);
    console.log(`   • ${permissions.length} Permissions`);
    console.log(`   • ${clients.length} Clients`);
    console.log(`   • ${partners.length} Partners`);
    console.log(`   • ${categories.length} Supply Categories`);
    console.log(`   • ${supplies.length} Supplies`);
    console.log(`   • ${events.length} Events`);
    console.log(`   • ${payments.length} Payments`);
    console.log(`   • ${finance.length} Finance Records`);
    console.log(`   • ${tasks.length} Tasks`);
    console.log(`   • ${reminders.length} Reminders`);
    console.log(`   • ${invoices.length} Invoices`);
    console.log(`   • ${contracts.length} Contracts`);

    console.log("\n🔐 Demo Accounts:");
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

// Run the seed
seedDatabase();
