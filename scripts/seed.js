import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Venue from "../models/Venue.js";
import Client from "../models/Client.js";
import Partner from "../models/Partner.js";
import Event from "../models/Event.js";
import Payment from "../models/Payment.js";
import Finance from "../models/Finance.js";
import Task from "../models/Task.js";
import Reminder from "../models/Reminder.js";

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🍃 Connected to MongoDB");

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Venue.deleteMany({}),
      Client.deleteMany({}),
      Partner.deleteMany({}),
      Event.deleteMany({}),
      Payment.deleteMany({}),
      Finance.deleteMany({}),
      Task.deleteMany({}),
      Reminder.deleteMany({}),
    ]);
    console.log("🗑️ Cleared existing data");

    // Create sample venue
    const venue = new Venue({
      name: "Salle des Fêtes El Yasmine",
      description: "Une magnifique salle de réception pour tous vos événements",
      address: {
        street: "123 Avenue Habib Bourguiba",
        city: "Tunis",
        state: "Tunis",
        zipCode: "1000",
        country: "Tunisia",
      },
      contact: {
        phone: "+216 71 123 456",
        email: "contact@salleelyasmine.tn",
        website: "www.salleelyasmine.tn",
      },
      capacity: {
        min: 50,
        max: 300,
      },
      amenities: ["parking", "wifi", "ac", "sound-system", "kitchen"],
      pricing: {
        basePrice: 500,
        pricePerGuest: 15,
        cleaningFee: 100,
        securityDeposit: 200,
      },
      subscription: {
        plan: "annual",
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        amount: 990,
      },
      owner: null, // Will be set after user creation
    });

    // Create sample users
    const owner = new User({
      name: "Ahmed Ben Ali",
      email: "ahmed@salleelyasmine.tn",
      password: "password123",
      role: "owner",
      phone: "+216 98 123 456",
      venueId: venue._id,
    });

    const manager = new User({
      name: "Fatima Trabelsi",
      email: "fatima@salleelyasmine.tn",
      password: "password123",
      role: "manager",
      phone: "+216 97 654 321",
      venueId: venue._id,
    });

    const staff = new User({
      name: "Mohamed Khelifi",
      email: "mohamed@salleelyasmine.tn",
      password: "password123",
      role: "staff",
      phone: "+216 96 789 012",
      venueId: venue._id,
    });

    venue.owner = owner._id;
    await venue.save();
    await Promise.all([owner.save(), manager.save(), staff.save()]);
    console.log("👥 Created users and venue");

    // Create sample clients
    const clients = await Client.create([
      {
        name: "Sarra & Karim",
        email: "sarra.karim@email.com",
        phone: "+216 95 111 222",
        company: "",
        address: {
          street: "45 Rue de la République",
          city: "Tunis",
          state: "Tunis",
          country: "Tunisia",
        },
        status: "vip",
        totalSpent: 2500,
        venueId: venue._id,
        createdBy: owner._id,
      },
      {
        name: "Entreprise TechCorp",
        email: "events@techcorp.tn",
        phone: "+216 71 555 666",
        company: "TechCorp Tunisia",
        address: {
          street: "88 Avenue de la Liberté",
          city: "Tunis",
          state: "Tunis",
          country: "Tunisia",
        },
        status: "active",
        totalSpent: 1800,
        venueId: venue._id,
        createdBy: manager._id,
      },
    ]);
    console.log("👤 Created sample clients");

    // Create sample partners
    const partners = await Partner.create([
      {
        name: "Chef Mahmoud",
        company: "Catering Délices",
        email: "mahmoud@delices.tn",
        phone: "+216 98 777 888",
        category: "catering",
        specialties: [
          "Cuisine tunisienne",
          "Buffet international",
          "Pâtisserie",
        ],
        rating: 4.8,
        priceRange: { min: 25, max: 45 },
        availability: "available",
        venueId: venue._id,
        createdBy: owner._id,
      },
      {
        name: "Studio Photo Lumière",
        company: "Lumière Photography",
        email: "contact@lumiere-photo.tn",
        phone: "+216 97 333 444",
        category: "photography",
        specialties: ["Mariage", "Événements corporate", "Portraits"],
        rating: 4.9,
        priceRange: { min: 300, max: 800 },
        availability: "available",
        venueId: venue._id,
        createdBy: owner._id,
      },
    ]);
    console.log("🤝 Created sample partners");

    // Create sample events with proper date handling
    const eventStartDate1 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const eventEndDate1 = new Date(
      eventStartDate1.getTime() + 8 * 60 * 60 * 1000
    ); // 8 hours later

    const eventStartDate2 = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000); // 45 days from now
    const eventEndDate2 = new Date(
      eventStartDate2.getTime() + 8 * 60 * 60 * 1000
    ); // 8 hours later

    const events = await Event.create([
      {
        title: "Mariage Sarra & Karim",
        description: "Célébration de mariage avec 150 invités",
        type: "wedding",
        client: clients[0]._id,
        startDate: eventStartDate1,
        endDate: eventEndDate1,
        startTime: "18:00",
        endTime: "02:00",
        guestCount: 150,
        status: "confirmed",
        pricing: {
          basePrice: 500,
          additionalServices: [
            { name: "Décoration florale", price: 300 },
            { name: "Éclairage spécial", price: 200 },
          ],
          discount: 0,
          totalAmount: 1000,
        },
        payment: {
          status: "partial",
          paidAmount: 500,
          dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        },
        partners: [
          {
            partner: partners[0]._id,
            service: "Catering",
            cost: 400,
            status: "confirmed",
          },
          {
            partner: partners[1]._id,
            service: "Photography",
            cost: 600,
            status: "confirmed",
          },
        ],
        venueId: venue._id,
        createdBy: owner._id,
      },
      {
        title: "Conférence TechCorp 2024",
        description: "Conférence annuelle de l'entreprise",
        type: "corporate",
        client: clients[1]._id,
        startDate: eventStartDate2,
        endDate: eventEndDate2,
        startTime: "09:00",
        endTime: "17:00",
        guestCount: 80,
        status: "pending",
        pricing: {
          basePrice: 500,
          additionalServices: [
            { name: "Équipement audiovisuel", price: 250 },
            { name: "Pause café", price: 150 },
          ],
          discount: 50,
          totalAmount: 850,
        },
        payment: {
          status: "pending",
          paidAmount: 0,
          dueDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        },
        venueId: venue._id,
        createdBy: manager._id,
      },
    ]);
    console.log("🎉 Created sample events");

    // Create sample payments
    await Payment.create([
      {
        event: events[0]._id,
        client: clients[0]._id,
        amount: 500,
        method: "bank-transfer",
        status: "completed",
        reference: "TXN-001-2024",
        description: "Acompte mariage Sarra & Karim",
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        paidDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        netAmount: 485,
        fees: { processingFee: 15 },
        venueId: venue._id,
        processedBy: owner._id,
      },
    ]);
    console.log("💳 Created sample payments");

    // Create sample finance records
    await Finance.create([
      {
        type: "income",
        category: "event-revenue",
        description: "Acompte mariage Sarra & Karim",
        amount: 500,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        reference: "TXN-001-2024",
        venueId: venue._id,
        createdBy: owner._id,
      },
      {
        type: "expense",
        category: "utilities",
        description: "Facture électricité décembre",
        amount: 180,
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        reference: "ELEC-DEC-2024",
        venueId: venue._id,
        createdBy: manager._id,
      },
    ]);
    console.log("💰 Created sample finance records");

    // Create sample tasks with correct status values
    await Task.create([
      {
        title: "Préparer décoration mariage Sarra & Karim",
        description:
          "Installer les décorations florales et l'éclairage spécial",
        priority: "high",
        status: "todo", // Fixed: using correct enum value
        assignedTo: staff._id,
        dueDate: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000),
        relatedEvent: events[0]._id,
        venueId: venue._id,
        createdBy: owner._id,
      },
      {
        title: "Vérifier équipement audiovisuel",
        description: "Tester tous les équipements avant la conférence TechCorp",
        priority: "medium",
        status: "todo", // Fixed: using correct enum value
        assignedTo: staff._id,
        dueDate: new Date(Date.now() + 44 * 24 * 60 * 60 * 1000),
        relatedEvent: events[1]._id,
        venueId: venue._id,
        createdBy: manager._id,
      },
    ]);
    console.log("✅ Created sample tasks");

    // Create sample reminders
    await Reminder.create([
      {
        title: "Appeler client pour solde mariage",
        description:
          "Contacter Sarra & Karim pour le paiement du solde restant",
        type: "payment",
        priority: "high",
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        status: "active",
        assignedTo: owner._id,
        relatedEvent: events[0]._id,
        venueId: venue._id,
        createdBy: owner._id,
      },
      {
        title: "Confirmer menu avec traiteur",
        description: "Finaliser le menu avec Chef Mahmoud pour le mariage",
        type: "vendor",
        priority: "medium",
        dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        status: "active",
        assignedTo: manager._id,
        relatedEvent: events[0]._id,
        venueId: venue._id,
        createdBy: owner._id,
      },
    ]);
    console.log("🔔 Created sample reminders");

    console.log("✨ Database seeded successfully!");
    console.log("\n📊 Summary:");
    console.log("- 1 Venue created");
    console.log("- 3 Users created (Owner, Manager, Staff)");
    console.log("- 2 Clients created");
    console.log("- 2 Partners created");
    console.log("- 2 Events created");
    console.log("- 1 Payment created");
    console.log("- 2 Finance records created");
    console.log("- 2 Tasks created");
    console.log("- 2 Reminders created");
    console.log("\n🔐 Login credentials:");
    console.log("Owner: ahmed@salleelyasmine.tn / password123");
    console.log("Manager: fatima@salleelyasmine.tn / password123");
    console.log("Staff: mohamed@salleelyasmine.tn / password123");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

// Run the seed function
seedData();
