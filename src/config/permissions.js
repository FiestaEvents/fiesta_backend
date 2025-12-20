//config/permissions.js
export const PERMISSIONS = [
  // Events
  { name: "events.create", displayName: "Create Events", module: "events", action: "create", scope: "all" },
  { name: "events.read.all", displayName: "View All Events", module: "events", action: "read", scope: "all" },
  { name: "events.read.own", displayName: "View Own Events", module: "events", action: "read", scope: "own" },
  { name: "events.update.all", displayName: "Edit All Events", module: "events", action: "update", scope: "all" },
  { name: "events.update.own", displayName: "Edit Own Events", module: "events", action: "update", scope: "own" },
  { name: "events.delete.all", displayName: "Delete Events", module: "events", action: "delete", scope: "all" },
  { name: "events.export", displayName: "Export Events", module: "events", action: "export", scope: "all" },

  // Clients
  { name: "clients.create", displayName: "Create Clients", module: "clients", action: "create", scope: "all" },
  { name: "clients.read.all", displayName: "View All Clients", module: "clients", action: "read", scope: "all" },
  { name: "clients.update.all", displayName: "Edit Clients", module: "clients", action: "update", scope: "all" },
  { name: "clients.delete.all", displayName: "Delete Clients", module: "clients", action: "delete", scope: "all" },

  // Partners
  { name: "partners.create", displayName: "Create Partners", module: "partners", action: "create", scope: "all" },
  { name: "partners.read.all", displayName: "View All Partners", module: "partners", action: "read", scope: "all" },
  { name: "partners.update.all", displayName: "Edit Partners", module: "partners", action: "update", scope: "all" },
  { name: "partners.delete.all", displayName: "Delete Partners", module: "partners", action: "delete", scope: "all" },

  // Finance
  { name: "finance.create", displayName: "Create Finance Records", module: "finance", action: "create", scope: "all" },
  { name: "finance.read.all", displayName: "View All Finance Records", module: "finance", action: "read", scope: "all" },
  { name: "finance.update.all", displayName: "Edit Finance Records", module: "finance", action: "update", scope: "all" },
  { name: "finance.delete.all", displayName: "Delete Finance Records", module: "finance", action: "delete", scope: "all" },
  { name: "finance.export", displayName: "Export Financial Data", module: "finance", action: "export", scope: "all" },

  // Payments
  { name: "payments.create", displayName: "Process Payments", module: "payments", action: "create", scope: "all" },
  { name: "payments.read.all", displayName: "View All Payments", module: "payments", action: "read", scope: "all" },
  { name: "payments.update.all", displayName: "Edit Payments", module: "payments", action: "update", scope: "all" },
  { name: "payments.delete.all", displayName: "Delete Payments", module: "payments", action: "delete", scope: "all" },

  // Tasks
  { name: "tasks.create", displayName: "Create Tasks", module: "tasks", action: "create", scope: "all" },
  { name: "tasks.read.all", displayName: "View All Tasks", module: "tasks", action: "read", scope: "all" },
  { name: "tasks.read.own", displayName: "View Assigned Tasks", module: "tasks", action: "read", scope: "own" },
  { name: "tasks.update.all", displayName: "Edit All Tasks", module: "tasks", action: "update", scope: "all" },
  { name: "tasks.update.own", displayName: "Edit Assigned Tasks", module: "tasks", action: "update", scope: "own" },
  { name: "tasks.delete.all", displayName: "Delete Tasks", module: "tasks", action: "delete", scope: "all" },

  // Reminders
  { name: "reminders.create", displayName: "Create Reminders", module: "reminders", action: "create", scope: "all" },
  { name: "reminders.read.all", displayName: "View All Reminders", module: "reminders", action: "read", scope: "all" },
  { name: "reminders.update.all", displayName: "Edit Reminders", module: "reminders", action: "update", scope: "all" },
  { name: "reminders.delete.all", displayName: "Delete Reminders", module: "reminders", action: "delete", scope: "all" },

  // Users & Team
  { name: "users.create", displayName: "Invite Team Members", module: "users", action: "create", scope: "all" },
  { name: "users.read.all", displayName: "View All Team Members", module: "users", action: "read", scope: "all" },
  { name: "users.update.all", displayName: "Edit Team Members", module: "users", action: "update", scope: "all" },
  { name: "users.delete.all", displayName: "Remove Team Members", module: "users", action: "delete", scope: "all" },

  // Roles
  { name: "roles.create", displayName: "Create Custom Roles", module: "roles", action: "create", scope: "all" },
  { name: "roles.read.all", displayName: "View Roles", module: "roles", action: "read", scope: "all" },
  { name: "roles.update.all", displayName: "Edit Roles", module: "roles", action: "update", scope: "all" },
  { name: "roles.delete.all", displayName: "Delete Custom Roles", module: "roles", action: "delete", scope: "all" },
  { name: "roles.manage", displayName: "Full Role Management", module: "roles", action: "manage", scope: "all" },

  // Venue
  { name: "venue.read", displayName: "View Venue Settings", module: "venue", action: "read", scope: "all" },
  { name: "venue.update", displayName: "Edit Venue Settings", module: "venue", action: "update", scope: "all" },
  { name: "venue.manage", displayName: "Full Venue Management", module: "venue", action: "manage", scope: "all" },

  // Reports
  { name: "reports.read.all", displayName: "View All Reports", module: "reports", action: "read", scope: "all" },
  { name: "reports.export", displayName: "Export Reports", module: "reports", action: "export", scope: "all" },

  // Settings
  { name: "settings.read", displayName: "View Settings", module: "settings", action: "read", scope: "all" },
  { name: "settings.update", displayName: "Edit Settings", module: "settings", action: "update", scope: "all" },
];