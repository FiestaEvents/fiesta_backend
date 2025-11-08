import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { 
  Permission, 
  Role, 
  Venue, 
  User, 
  Client, 
  Partner, 
  Event, 
  Payment, 
  Finance, 
  Task, 
  Reminder 
} from "../models/index.js";
import { PERMISSIONS } from "../config/permissions.js";
import { DEFAULT_ROLES } from "../config/roles.js";
import config from "../config/env.js";
import connectDB from "../config/database.js";

const DEFAULT_OWNER_PASSWORD = "password123";
const SALT_ROUNDS = 10;

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("🌱 Starting database seeding...\n");

    // 1. Clear existing data
    await Permission.deleteMany({});
    await Role.deleteMany({});
    await User.deleteMany({});
    await Client.deleteMany({});
    await Partner.deleteMany({});
    await Event.deleteMany({});
    await Payment.deleteMany({});
    await Finance.deleteMany({});
    await Task.deleteMany({});
    await Reminder.deleteMany({});
    await Venue.deleteMany({});
    console.log("✅ Cleared all existing data\n");

    // 2. Seed Permissions
    console.log("📝 Seeding permissions...");
    const permissionPromises = PERMISSIONS.map(async (perm) => {
      return Permission.findOneAndUpdate(
        { name: perm.name },
        perm,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    });

    const createdPermissions = await Promise.all(permissionPromises);
    console.log(`✅ Created ${createdPermissions.length} permissions\n`);

    const permissionMap = {};
    createdPermissions.forEach((p) => {
      permissionMap[p.name] = p._id;
    });

    // 3. Create Demo Venue
    console.log("📍 Creating demo venue...");
    const demoVenue = await Venue.create({
      name: "Fiesta Demo Venue",
      description: "A beautiful event venue for all occasions - weddings, corporate events, birthdays and more!",
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
      amenities: [
        "WiFi",
        "Parking",
        "Audio/Visual Equipment",
        "Kitchen",
        "Bar",
        "Stage",
        "Dance Floor",
        "Outdoor Space",
      ],
      operatingHours: {
        monday: { open: "09:00", close: "22:00", closed: false },
        tuesday: { open: "09:00", close: "22:00", closed: false },
        wednesday: { open: "09:00", close: "22:00", closed: false },
        thursday: { open: "09:00", close: "22:00", closed: false },
        friday: { open: "09:00", close: "23:00", closed: false },
        saturday: { open: "10:00", close: "23:00", closed: false },
        sunday: { open: "10:00", close: "20:00", closed: false },
      },
      subscription: {
        plan: "annual",
        status: "active",
        startDate: new Date(),
        amount: 1200,
      },
      owner: new mongoose.Types.ObjectId(),
      timeZone: "America/New_York",
      isActive: true,
    });
    console.log("✅ Created demo venue\n");

    // 4. Seed Roles
    console.log("👥 Seeding roles...");
    const roles = {};
    for (const roleConfig of DEFAULT_ROLES) {
      const permissionIds =
        roleConfig.permissions === "ALL"
          ? createdPermissions.map((p) => p._id)
          : roleConfig.permissions.map((permName) => permissionMap[permName]).filter(Boolean);

      const role = await Role.create({
        ...roleConfig,
        permissions: permissionIds,
        venueId: demoVenue._id,
      });
      roles[roleConfig.name] = role;
    }
    console.log(`✅ Created roles for venue\n`);

    // 5. Create Demo Users
    console.log("👤 Creating demo users...");
    const demoOwner = await User.create({
      name: "Demo Owner",
      email: "owner@demo.com",
      password: DEFAULT_OWNER_PASSWORD,
      phone: "+1234567890",
      roleId: roles.Owner._id,
      roleType: "owner",
      venueId: demoVenue._id,
      isActive: true,
    });

    const demoManager = await User.create({
      name: "John Manager",
      email: "manager@demo.com",
      password: DEFAULT_OWNER_PASSWORD,
      phone: "+1234567891",
      roleId: roles.Manager._id,
      roleType: "manager",
      venueId: demoVenue._id,
      isActive: true,
    });

    const demoStaff = await User.create({
      name: "Sarah Staff",
      email: "staff@demo.com",
      password: DEFAULT_OWNER_PASSWORD,
      phone: "+1234567892",
      roleId: roles.Staff._id,
      roleType: "staff",
      venueId: demoVenue._id,
      isActive: true,
    });

    // Update venue owner
    demoVenue.owner = demoOwner._id;
    await demoVenue.save();

    console.log("✅ Created demo users");
    console.log(`   - Owner: ${demoOwner.email}`);
    console.log(`   - Manager: ${demoManager.email}`);
    console.log(`   - Staff: ${demoStaff.email}`);
    console.log(`   - Password for all: ${DEFAULT_OWNER_PASSWORD}\n`);

    // 6. Seed Clients
    console.log("👥 Seeding clients...");
    const clients = await Client.create([
      {
        name: "Sarah Johnson",
        email: "sarah.johnson@email.com",
        phone: "+1555-0101",
        venueId: demoVenue._id,
        status: "active",
        company: "Tech Innovations Inc",
        address: {
          street: "456 Oak Avenue",
          city: "New York",
          state: "NY",
          zipCode: "10002",
          country: "USA",
        },
        notes: "Planning corporate event. Prefers modern setup.",
        tags: ["corporate", "VIP", "repeat-client"],
        createdBy: demoOwner._id,
      },
      {
        name: "Michael Chen",
        email: "michael.chen@email.com",
        phone: "+1555-0102",
        venueId: demoVenue._id,
        status: "active",
        company: null,
        address: {
          street: "789 Pine Street",
          city: "Brooklyn",
          state: "NY",
          zipCode: "11201",
          country: "USA",
        },
        notes: "Wedding client. Wants outdoor ceremony.",
        tags: ["wedding", "summer"],
        createdBy: demoOwner._id,
      },
      {
        name: "Emily Rodriguez",
        email: "emily.rodriguez@email.com",
        phone: "+1555-0103",
        venueId: demoVenue._id,
        status: "active",
        company: "Rodriguez Events",
        notes: "Event planner. Books multiple events per year.",
        tags: ["planner", "VIP"],
        createdBy: demoManager._id,
      },
      {
        name: "David Park",
        email: "david.park@email.com",
        phone: "+1555-0104",
        venueId: demoVenue._id,
        status: "active",
        notes: "Birthday party for 50th celebration.",
        tags: ["birthday"],
        createdBy: demoStaff._id,
      },
      {
        name: "Jennifer White",
        email: "jennifer.white@email.com",
        phone: "+1555-0105",
        venueId: demoVenue._id,
        status: "active",
        company: "Global Corp",
        notes: "Annual conference client.",
        tags: ["corporate", "annual"],
        createdBy: demoManager._id,
      },
    ]);
    console.log(`✅ Created ${clients.length} clients\n`);

    // 7. Seed Partners
    console.log("🤝 Seeding partners...");
    const partners = await Partner.create([
      {
        name: "Elegant Catering Co",
        email: "info@elegantcatering.com",
        phone: "+1555-0201",
        venueId: demoVenue._id,
        category: "catering",
        company: "Elegant Catering Co",
        status: "active",
        location: "Manhattan, NY",
        specialties: "Fine dining, custom menus, dietary accommodations",
        hourlyRate: 150,
        rating: 4.8,
        totalJobs: 45,
        address: {
          city: "Manhattan",
          state: "NY",
          country: "USA",
        },
        notes: "Excellent for upscale events. Book 2 weeks in advance.",
        createdBy: demoOwner._id,
      },
      {
        name: "Perfect Decorations",
        email: "contact@perfectdeco.com",
        phone: "+1555-0202",
        venueId: demoVenue._id,
        category: "decoration",
        company: "Perfect Decorations LLC",
        status: "active",
        specialties: "Wedding decor, floral arrangements, lighting",
        hourlyRate: 100,
        rating: 4.9,
        totalJobs: 67,
        notes: "Specializes in wedding decorations. Very creative.",
        createdBy: demoOwner._id,
      },
      {
        name: "Flash Photography Studio",
        email: "bookings@flashphoto.com",
        phone: "+1555-0203",
        venueId: demoVenue._id,
        category: "photography",
        company: "Flash Photography Studio",
        status: "active",
        specialties: "Event photography, videography, drone shots",
        hourlyRate: 200,
        rating: 4.7,
        totalJobs: 89,
        notes: "Professional team. Includes editing.",
        createdBy: demoManager._id,
      },
      {
        name: "Sound Waves AV",
        email: "info@soundwavesav.com",
        phone: "+1555-0204",
        venueId: demoVenue._id,
        category: "audio_visual",
        company: "Sound Waves AV",
        status: "active",
        specialties: "Sound systems, lighting, projectors, live streaming",
        hourlyRate: 125,
        rating: 4.6,
        totalJobs: 34,
        notes: "Great for corporate events and conferences.",
        createdBy: demoStaff._id,
      },
    ]);
    console.log(`✅ Created ${partners.length} partners\n`);

    // 8. Seed Events
    console.log("📅 Seeding events...");
    const today = new Date();
    const events = await Event.create([
      {
        title: "Smith-Johnson Wedding",
        description: "Beautiful summer wedding with outdoor ceremony and indoor reception",
        type: "wedding",
        clientId: clients[1]._id,
        startDate: new Date(today.getFullYear(), today.getMonth() + 1, 15),
        endDate: new Date(today.getFullYear(), today.getMonth() + 1, 15),
        startTime: "15:00",
        endTime: "23:00",
        guestCount: 150,
        status: "confirmed",
        pricing: {
          basePrice: 8000,
          additionalServices: [
            { name: "Premium Catering Package", price: 4500 },
            { name: "Floral Decorations", price: 2000 },
            { name: "Photography & Videography", price: 3000 },
          ],
          discount: 500,
          totalAmount: 17000,
        },
        paymentSummary: {
          totalAmount: 17000,
          paidAmount: 8500,
          status: "partial",
        },
        partners: [
          {
            partner: partners[0]._id,
            service: "Premium Catering",
            cost: 4500,
            status: "confirmed",
          },
          {
            partner: partners[1]._id,
            service: "Floral Decorations",
            cost: 2000,
            status: "confirmed",
          },
          {
            partner: partners[2]._id,
            service: "Photography & Videography",
            cost: 3000,
            status: "confirmed",
          },
        ],
        requirements: {
          setup: "Outdoor ceremony setup, indoor reception",
          catering: "Buffet style dinner, open bar",
          decoration: "White and blush pink theme, floral centerpieces",
          audioVisual: "Microphone for ceremony, DJ setup for reception",
          other: "Dedicated parking attendant needed",
        },
        notes: "Bride wants specific song for first dance. Coordinate with DJ.",
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        title: "Tech Innovations Annual Conference",
        description: "Three-day corporate conference with keynote speakers and breakout sessions",
        type: "conference",
        clientId: clients[0]._id,
        startDate: new Date(today.getFullYear(), today.getMonth() + 2, 5),
        endDate: new Date(today.getFullYear(), today.getMonth() + 2, 7),
        startTime: "08:00",
        endTime: "18:00",
        guestCount: 200,
        status: "confirmed",
        pricing: {
          basePrice: 15000,
          additionalServices: [
            { name: "AV Equipment & Support", price: 5000 },
            { name: "Catering (3 days)", price: 8000 },
          ],
          discount: 1000,
          totalAmount: 27000,
        },
        paymentSummary: {
          totalAmount: 27000,
          paidAmount: 27000,
          status: "paid",
        },
        partners: [
          {
            partner: partners[0]._id,
            service: "Corporate Catering",
            cost: 8000,
            status: "confirmed",
          },
          {
            partner: partners[3]._id,
            service: "AV Equipment",
            cost: 5000,
            status: "confirmed",
          },
        ],
        requirements: {
          setup: "Theater-style main hall, classroom setup for breakouts",
          catering: "Continental breakfast, lunch buffet, afternoon snacks",
          audioVisual: "Projectors, screens, sound system, live streaming",
          other: "WiFi for 200+ devices, charging stations",
        },
        notes: "Client is a repeat customer. Provide VIP service.",
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "David's 50th Birthday Bash",
        description: "Surprise birthday party with live music and dancing",
        type: "birthday",
        clientId: clients[3]._id,
        startDate: new Date(today.getFullYear(), today.getMonth(), 28),
        endDate: new Date(today.getFullYear(), today.getMonth(), 28),
        startTime: "19:00",
        endTime: "23:00",
        guestCount: 80,
        status: "pending",
        pricing: {
          basePrice: 5000,
          additionalServices: [
            { name: "Catering Package", price: 2500 },
            { name: "Birthday Decorations", price: 800 },
          ],
          discount: 0,
          totalAmount: 8300,
        },
        paymentSummary: {
          totalAmount: 8300,
          paidAmount: 0,
          status: "pending",
        },
        partners: [
          {
            partner: partners[0]._id,
            service: "Catering",
            cost: 2500,
            status: "pending",
          },
          {
            partner: partners[1]._id,
            service: "Decorations",
            cost: 800,
            status: "pending",
          },
        ],
        requirements: {
          setup: "Dance floor in center, tables around perimeter",
          catering: "Appetizers, main course, birthday cake",
          decoration: "Gold and black theme, balloon arrangements",
          other: "It's a surprise party - coordinate arrival time",
        },
        venueId: demoVenue._id,
        createdBy: demoStaff._id,
      },
      {
        title: "Summer Networking Mixer",
        description: "Professional networking event for local businesses",
        type: "corporate",
        clientId: clients[2]._id,
        startDate: new Date(today.getFullYear(), today.getMonth() + 1, 20),
        endDate: new Date(today.getFullYear(), today.getMonth() + 1, 20),
        startTime: "18:00",
        endTime: "21:00",
        guestCount: 120,
        status: "confirmed",
        pricing: {
          basePrice: 4000,
          additionalServices: [
            { name: "Cocktail Catering", price: 3000 },
          ],
          discount: 200,
          totalAmount: 6800,
        },
        paymentSummary: {
          totalAmount: 6800,
          paidAmount: 3400,
          status: "partial",
        },
        partners: [
          {
            partner: partners[0]._id,
            service: "Cocktail Hour Catering",
            cost: 3000,
            status: "confirmed",
          },
        ],
        requirements: {
          setup: "Cocktail tables, standing room, registration desk",
          catering: "Passed appetizers, open bar",
          decoration: "Professional signage, company branding",
        },
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        title: "Global Corp End-of-Year Gala",
        description: "Formal gala dinner with awards ceremony",
        type: "corporate",
        clientId: clients[4]._id,
        startDate: new Date(today.getFullYear(), 11, 15),
        endDate: new Date(today.getFullYear(), 11, 15),
        startTime: "18:00",
        endTime: "23:00",
        guestCount: 180,
        status: "pending",
        pricing: {
          basePrice: 10000,
          additionalServices: [
            { name: "Premium Catering", price: 5400 },
            { name: "Formal Decorations", price: 2500 },
            { name: "Photography", price: 2000 },
          ],
          discount: 0,
          totalAmount: 19900,
        },
        paymentSummary: {
          totalAmount: 19900,
          paidAmount: 0,
          status: "pending",
        },
        partners: [],
        requirements: {
          setup: "Formal dining setup, stage for awards",
          catering: "Plated dinner service, premium wine selection",
          decoration: "Elegant and formal theme",
        },
        notes: "Still finalizing details with client.",
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
    ]);
    console.log(`✅ Created ${events.length} events\n`);

    // 9. Seed Payments
    console.log("💰 Seeding payments...");
    const payments = await Payment.create([
      {
        event: events[0]._id,
        client: clients[1]._id,
        type: "income",
        amount: 8500,
        method: "bank_transfer",
        status: "completed",
        reference: "PAY-2024-001",
        description: "Deposit payment for Smith-Johnson Wedding",
        dueDate: new Date(today.getFullYear(), today.getMonth(), 1),
        paidDate: new Date(today.getFullYear(), today.getMonth(), 3),
        fees: {
          processingFee: 85,
          platformFee: 0,
          otherFees: 0,
        },
        venueId: demoVenue._id,
        processedBy: demoManager._id,
      },
      {
        event: events[1]._id,
        client: clients[0]._id,
        type: "income",
        amount: 27000,
        method: "credit_card",
        status: "completed",
        reference: "PAY-2024-002",
        description: "Full payment for Tech Innovations Conference",
        dueDate: new Date(today.getFullYear(), today.getMonth(), 15),
        paidDate: new Date(today.getFullYear(), today.getMonth(), 15),
        fees: {
          processingFee: 270,
          platformFee: 100,
          otherFees: 0,
        },
        venueId: demoVenue._id,
        processedBy: demoOwner._id,
      },
      {
        event: events[3]._id,
        client: clients[2]._id,
        type: "income",
        amount: 3400,
        method: "check",
        status: "completed",
        reference: "PAY-2024-003",
        description: "Deposit for Summer Networking Mixer",
        paidDate: new Date(today.getFullYear(), today.getMonth() - 1, 20),
        fees: {
          processingFee: 0,
          platformFee: 0,
          otherFees: 0,
        },
        venueId: demoVenue._id,
        processedBy: demoStaff._id,
      },
      {
        type: "expense",
        amount: 1200,
        method: "bank_transfer",
        status: "completed",
        reference: "EXP-2024-001",
        description: "Monthly venue maintenance",
        paidDate: new Date(today.getFullYear(), today.getMonth(), 5),
        fees: {
          processingFee: 0,
          platformFee: 0,
          otherFees: 0,
        },
        venueId: demoVenue._id,
        processedBy: demoOwner._id,
      },
      {
        event: events[2]._id,
        client: clients[3]._id,
        type: "income",
        amount: 8300,
        method: "cash",
        status: "pending",
        reference: "PAY-2024-004",
        description: "Payment for David's 50th Birthday",
        dueDate: new Date(today.getFullYear(), today.getMonth(), 25),
        fees: {
          processingFee: 0,
          platformFee: 0,
          otherFees: 0,
        },
        venueId: demoVenue._id,
        processedBy: demoStaff._id,
      },
    ]);
    console.log(`✅ Created ${payments.length} payments\n`);

    // Update event payment references
    events[0].payments = [payments[0]._id];
    events[1].payments = [payments[1]._id];
    events[3].payments = [payments[2]._id];
    events[2].payments = [payments[4]._id];
    
    await Promise.all(events.map(e => e.save()));

    // 10. Seed Finance Records
    console.log("📊 Seeding finance records...");
    const financeRecords = await Finance.create([
      {
        type: "income",
        category: "event_revenue",
        description: "Wedding event revenue - Smith-Johnson",
        amount: 17000,
        date: new Date(today.getFullYear(), today.getMonth(), 3),
        paymentMethod: "bank_transfer",
        reference: "REV-2024-001",
        relatedEvent: events[0]._id,
        status: "completed",
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        type: "income",
        category: "event_revenue",
        description: "Corporate conference revenue - Tech Innovations",
        amount: 27000,
        date: new Date(today.getFullYear(), today.getMonth(), 15),
        paymentMethod: "card",
        reference: "REV-2024-002",
        relatedEvent: events[1]._id,
        status: "completed",
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        type: "expense",
        category: "partner_payment",
        description: "Catering payment - Elegant Catering Co",
        amount: 4500,
        date: new Date(today.getFullYear(), today.getMonth(), 10),
        paymentMethod: "bank_transfer",
        reference: "EXP-2024-002",
        relatedPartner: partners[0]._id,
        status: "completed",
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        type: "expense",
        category: "utilities",
        description: "Monthly electricity bill",
        amount: 850,
        date: new Date(today.getFullYear(), today.getMonth(), 1),
        paymentMethod: "bank_transfer",
        reference: "EXP-2024-003",
        status: "completed",
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        type: "expense",
        category: "marketing",
        description: "Social media advertising campaign",
        amount: 500,
        date: new Date(today.getFullYear(), today.getMonth(), 12),
        paymentMethod: "card",
        reference: "EXP-2024-004",
        status: "completed",
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        type: "expense",
        category: "maintenance",
        description: "HVAC system maintenance",
        amount: 1200,
        date: new Date(today.getFullYear(), today.getMonth(), 5),
        paymentMethod: "check",
        reference: "EXP-2024-005",
        status: "completed",
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
    ]);
    console.log(`✅ Created ${financeRecords.length} finance records\n`);

    // 11. Seed Tasks - ENHANCED VERSION
    console.log("✅ Seeding enhanced tasks...");
    const tasks = await Task.create([
      {
        title: "Confirm catering menu for Smith-Johnson Wedding",
        description: "Review and finalize the catering menu with the couple. Check for dietary restrictions and confirm final guest count.",
        priority: "high",
        status: "in_progress",
        category: "event_preparation",
        dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 5),
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
        reminderDate: new Date(today.getFullYear(), today.getMonth() + 1, 3),
        estimatedHours: 3,
        actualHours: 1.5,
        progress: 60,
        assignedTo: demoManager._id,
        assignedBy: demoOwner._id,
        assignedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        watchers: [demoOwner._id, demoStaff._id],
        relatedEvent: events[0]._id,
        relatedClient: clients[1]._id,
        relatedPartner: partners[0]._id,
        subtasks: [
          { 
            title: "Send menu options to client", 
            description: "Email 3 menu options with pricing",
            completed: true, 
            completedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5),
            completedBy: demoManager._id,
            order: 0,
          },
          { 
            title: "Schedule tasting session", 
            description: "Book tasting for next week",
            completed: true, 
            completedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2),
            completedBy: demoManager._id,
            order: 1,
          },
          { 
            title: "Finalize menu selection",
            description: "Get final approval from couple", 
            completed: false,
            order: 2,
          },
          {
            title: "Coordinate with caterer",
            description: "Send final headcount to Elegant Catering",
            completed: false,
            order: 3,
          },
        ],
        comments: [
          {
            text: "Client requested vegetarian and gluten-free options",
            author: demoManager._id,
            createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3),
          },
          {
            text: "Tasting went great! They loved option 2",
            author: demoManager._id,
            createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
          },
        ],
        tags: ["wedding", "catering", "urgent"],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Setup AV equipment test for conference",
        description: "Complete end-to-end testing of all audio-visual equipment before the Tech Innovations Conference. Test projectors, microphones, speakers, and live streaming setup.",
        priority: "urgent",
        status: "todo",
        category: "event_preparation",
        dueDate: new Date(today.getFullYear(), today.getMonth() + 2, 3),
        startDate: new Date(today.getFullYear(), today.getMonth() + 2, 2),
        estimatedHours: 4,
        progress: 0,
        assignedTo: demoStaff._id,
        assignedBy: demoManager._id,
        assignedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        watchers: [demoManager._id],
        relatedEvent: events[1]._id,
        relatedClient: clients[0]._id,
        relatedPartner: partners[3]._id,
        subtasks: [
          { title: "Test projectors and screens", completed: false, order: 0 },
          { title: "Test wireless microphones", completed: false, order: 1 },
          { title: "Verify live streaming setup", completed: false, order: 2 },
          { title: "Check backup equipment", completed: false, order: 3 },
        ],
        dependencies: [],
        tags: ["conference", "av-equipment", "critical"],
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        title: "Follow up with David Park for birthday party deposit",
        description: "Contact client to secure deposit payment for the birthday event. Send payment link and confirm final details.",
        priority: "high",
        status: "pending",
        category: "client_followup",
        dueDate: new Date(today.getFullYear(), today.getMonth(), 20),
        estimatedHours: 1,
        progress: 0,
        assignedTo: demoStaff._id,
        assignedBy: demoManager._id,
        assignedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        relatedEvent: events[2]._id,
        relatedClient: clients[3]._id,
        tags: ["payment", "followup"],
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        title: "Coordinate with decorators for networking mixer",
        description: "Meet with Perfect Decorations to plan setup for professional networking event. Review floor plan and signage placement.",
        priority: "medium",
        status: "todo",
        category: "partner_coordination",
        dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 15),
        startDate: new Date(today.getFullYear(), today.getMonth() + 1, 13),
        estimatedHours: 2,
        progress: 0,
        assignedTo: demoManager._id,
        assignedBy: demoOwner._id,
        assignedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        watchers: [demoStaff._id],
        relatedEvent: events[3]._id,
        relatedClient: clients[2]._id,
        relatedPartner: partners[1]._id,
        subtasks: [
          { title: "Share floor plan with decorator", completed: false, order: 0 },
          { title: "Confirm delivery timeline", completed: false, order: 1 },
        ],
        tags: ["decorations", "networking"],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Monthly venue inspection",
        description: "Conduct routine inspection of venue facilities, equipment, and safety features. Document any issues that need attention.",
        priority: "medium",
        status: "completed",
        category: "maintenance",
        dueDate: new Date(today.getFullYear(), today.getMonth(), 1),
        startDate: new Date(today.getFullYear(), today.getMonth(), 1),
        estimatedHours: 3,
        actualHours: 2.5,
        progress: 100,
        assignedTo: demoStaff._id,
        assignedBy: demoOwner._id,
        assignedAt: new Date(today.getFullYear(), today.getMonth() - 1, 25),
        completedAt: new Date(today.getFullYear(), today.getMonth(), 2),
        completedBy: demoStaff._id,
        subtasks: [
          { 
            title: "Check fire safety equipment", 
            completed: true,
            completedAt: new Date(today.getFullYear(), today.getMonth(), 1),
            completedBy: demoStaff._id,
            order: 0,
          },
          { 
            title: "Inspect HVAC systems", 
            completed: true,
            completedAt: new Date(today.getFullYear(), today.getMonth(), 2),
            completedBy: demoStaff._id,
            order: 1,
          },
          { 
            title: "Test emergency lighting", 
            completed: true,
            completedAt: new Date(today.getFullYear(), today.getMonth(), 2),
            completedBy: demoStaff._id,
            order: 2,
          },
        ],
        comments: [
          {
            text: "All systems passed inspection. Minor HVAC filter replacement scheduled.",
            author: demoStaff._id,
            createdAt: new Date(today.getFullYear(), today.getMonth(), 2),
          },
        ],
        tags: ["maintenance", "inspection", "safety"],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Update website with new event photos",
        description: "Upload recent event photos to website gallery and social media. Ensure proper optimization and tagging.",
        priority: "low",
        status: "todo",
        category: "marketing",
        dueDate: new Date(today.getFullYear(), today.getMonth(), 25),
        estimatedHours: 2,
        progress: 0,
        assignedTo: demoManager._id,
        assignedBy: demoOwner._id,
        assignedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        subtasks: [
          { title: "Select best photos from last 3 events", completed: false, order: 0 },
          { title: "Optimize images for web", completed: false, order: 1 },
          { title: "Upload to website gallery", completed: false, order: 2 },
          { title: "Post highlights on social media", completed: false, order: 3 },
        ],
        tags: ["marketing", "social-media", "website"],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Prepare contract for End-of-Year Gala",
        description: "Draft and send service contract to Jennifer White for Global Corp's gala event. Include all terms and conditions.",
        priority: "high",
        status: "in_progress",
        category: "administrative",
        dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        estimatedHours: 3,
        actualHours: 1,
        progress: 35,
        assignedTo: demoOwner._id,
        watchers: [demoManager._id],
        relatedEvent: events[4]._id,
        relatedClient: clients[4]._id,
        subtasks: [
          { 
            title: "Draft contract terms",
            description: "Include pricing, cancellation policy, and service details", 
            completed: true,
            completedAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            completedBy: demoOwner._id,
            order: 0,
          },
          { 
            title: "Review with manager", 
            completed: false,
            order: 1,
          },
          { 
            title: "Send to client for review", 
            completed: false,
            order: 2,
          },
        ],
        tags: ["contract", "gala", "corporate"],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Order supplies for upcoming events",
        description: "Review inventory and order necessary supplies for next month's events including linens, disposables, and cleaning supplies.",
        priority: "medium",
        status: "blocked",
        category: "administrative",
        dueDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
        estimatedHours: 2,
        progress: 0,
        assignedTo: demoStaff._id,
        blockedReason: "Waiting for budget approval from owner",
        subtasks: [
          { title: "Check current inventory levels", completed: false, order: 0 },
          { title: "Get quotes from suppliers", completed: false, order: 1 },
          { title: "Submit budget request", completed: false, order: 2 },
        ],
        tags: ["supplies", "inventory"],
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        title: "Staff training session - Event Setup Best Practices",
        description: "Conduct training session for all staff on proper event setup procedures and best practices.",
        priority: "medium",
        status: "pending",
        category: "administrative",
        dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        estimatedHours: 4,
        progress: 0,
        assignedTo: demoOwner._id,
        watchers: [demoManager._id, demoStaff._id],
        subtasks: [
          { title: "Prepare training materials", completed: false, order: 0 },
          { title: "Schedule training session", completed: false, order: 1 },
          { title: "Send calendar invites to staff", completed: false, order: 2 },
          { title: "Conduct training", completed: false, order: 3 },
        ],
        tags: ["training", "staff", "procedures"],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Update emergency contact list",
        description: "Review and update emergency contact information for all partners, staff, and key vendors.",
        priority: "low",
        status: "todo",
        category: "administrative",
        dueDate: new Date(today.getFullYear(), today.getMonth(), 30),
        estimatedHours: 1,
        progress: 0,
        assignedTo: demoManager._id,
        tags: ["emergency", "contacts", "safety"],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
    ]);
    console.log(`✅ Created ${tasks.length} enhanced tasks\n`);

    // Create task dependencies
    console.log("🔗 Creating task dependencies...");
    tasks[1].dependencies.push({
      task: tasks[0]._id,
      type: "relates_to",
    });
    await tasks[1].save();
    console.log("✅ Created task dependencies\n");

    // 12. Seed Reminders
    console.log("🔔 Seeding reminders...");
    const invoices = [
  {
    invoiceNumber: 'VEN-0001',
    client: null, 
    clientName: 'John and Sarah Wedding',
    clientEmail: 'john.sarah@example.com',
    issueDate: new Date('2024-11-01'),
    dueDate: new Date('2024-12-01'),
    items: [
      {
        description: 'Venue Rental - Main Hall',
        quantity: 1,
        rate: 5000,
        amount: 5000
      },
      {
        description: 'Catering Service',
        quantity: 100,
        rate: 50,
        amount: 5000
      }
    ],
    subtotal: 10000,
    tax: 1000,
    totalAmount: 11000,
    status: 'paid'
  },];
    const reminders = await Reminder.create([
      {
        title: "Final payment due - Smith-Johnson Wedding",
        description: "Collect remaining balance of $8,500 from client",
        type: "payment",
        priority: "high",
        reminderDate: new Date(today.getFullYear(), today.getMonth() + 1, 10),
        reminderTime: "10:00",
        isRecurring: false,
        status: "active",
        notificationMethods: ["email", "in_app"],
        relatedEvent: events[0]._id,
        relatedClient: clients[1]._id,
        relatedPayment: payments[0]._id,
        relatedTask: tasks[0]._id,
        assignedTo: [demoManager._id],
        venueId: demoVenue._id,
        createdBy: demoManager._id,
      },
      {
        title: "Tech Innovations Conference - Day 1",
        description: "Conference starts today. Ensure all AV equipment is ready.",
        type: "event",
        priority: "urgent",
        reminderDate: new Date(today.getFullYear(), today.getMonth() + 2, 5),
        reminderTime: "07:00",
        isRecurring: false,
        status: "active",
        notificationMethods: ["email", "sms", "in_app"],
        relatedEvent: events[1]._id,
        relatedTask: tasks[1]._id,
        assignedTo: [demoOwner._id, demoManager._id, demoStaff._id],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Confirm decorations delivery",
        description: "Call Perfect Decorations to confirm delivery time for birthday party",
        type: "task",
        priority: "medium",
        reminderDate: new Date(today.getFullYear(), today.getMonth(), 26),
        reminderTime: "14:00",
        isRecurring: false,
        status: "active",
        notificationMethods: ["in_app"],
        relatedEvent: events[2]._id,
        relatedTask: tasks[3]._id,
        assignedTo: [demoStaff._id],
        venueId: demoVenue._id,
        createdBy: demoStaff._id,
      },
      {
        title: "Weekly staff meeting",
        description: "Team meeting to review upcoming events and tasks",
        type: "other",
        priority: "medium",
        reminderDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
        reminderTime: "09:00",
        isRecurring: true,
        recurrence: {
          frequency: "weekly",
          interval: 1,
          daysOfWeek: [1], // Monday
        },
        status: "active",
        notificationMethods: ["email", "in_app"],
        assignedTo: [demoOwner._id, demoManager._id, demoStaff._id],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Follow up on end-of-year gala details",
        description: "Contact Jennifer White to finalize menu and decoration preferences",
        type: "followup",
        priority: "medium",
        reminderDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        reminderTime: "11:00",
        isRecurring: false,
        status: "active",
        notificationMethods: ["email", "in_app"],
        relatedEvent: events[4]._id,
        relatedClient: clients[4]._id,
        relatedTask: tasks[6]._id,
        assignedTo: [demoOwner._id],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
      {
        title: "Monthly maintenance check",
        description: "Routine maintenance inspection of venue facilities",
        type: "maintenance",
        priority: "medium",
        reminderDate: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        reminderTime: "08:00",
        isRecurring: true,
        recurrence: {
          frequency: "monthly",
          interval: 1,
          dayOfMonth: 1,
        },
        status: "active",
        notificationMethods: ["in_app"],
        relatedTask: tasks[4]._id,
        assignedTo: [demoStaff._id],
        venueId: demoVenue._id,
        createdBy: demoOwner._id,
      },
    ]);
    console.log(`✅ Created ${reminders.length} reminders\n`);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n📊 Summary:");
    console.log(`   ✅ ${createdPermissions.length} Permissions`);
    console.log(`   ✅ ${Object.keys(roles).length} Roles`);
    console.log(`   ✅ 1 Venue (Fiesta Demo Venue)`);
    console.log(`   ✅ 3 Users (Owner, Manager, Staff)`);
    console.log(`   ✅ ${clients.length} Clients`);
    console.log(`   ✅ ${partners.length} Partners`);
    console.log(`   ✅ ${events.length} Events`);
    console.log(`   ✅ ${payments.length} Payments`);
    console.log(`   ✅ ${financeRecords.length} Finance Records`);
    console.log(`   ✅ ${tasks.length} Enhanced Tasks with:`);
    console.log(`      - Subtasks with descriptions and order`);
    console.log(`      - Comments and mentions`);
    console.log(`      - Progress tracking`);
    console.log(`      - Watchers and assignees`);
    console.log(`      - Tags and dependencies`);
    console.log(`      - Multiple statuses (pending, todo, in_progress, completed, blocked)`);
    console.log(`   ✅ ${reminders.length} Reminders`);
    console.log("\n🔐 Login Credentials:");
    console.log("   Owner:   owner@demo.com   | password123");
    console.log("   Manager: manager@demo.com | password123");
    console.log("   Staff:   staff@demo.com   | password123");
    console.log("\n✨ Your database is now populated with comprehensive demo data!");
    console.log("   All enhanced task features are available:");
    console.log("   • Task statuses, priorities, and categories");
    console.log("   • Progress tracking and time logging");
    console.log("   • Subtasks with completion tracking");
    console.log("   • Comments and collaboration");
    console.log("   • Watchers and assignments");
    console.log("   • Tags and dependencies");
    console.log("   • Blocked tasks with reasons");
    console.log("   Start your server and explore the full task management system!\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  seedDatabase();
}

export default seedDatabase;
