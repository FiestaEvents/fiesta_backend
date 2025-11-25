import Contract from "../models/Contract.js";
import ContractSettings from "../models/ContractSettings.js";
import Client from "../models/Client.js";
import Partner from "../models/Partner.js";
import Event from "../models/Event.js";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

// Helper to generate sequential contract numbers
const generateContractNumber = async (venueId) => {
  const currentYear = new Date().getFullYear();
  const count = await Contract.countDocuments({
    venue: venueId,
    createdAt: {
      $gte: new Date(currentYear, 0, 1),
      $lt: new Date(currentYear + 1, 0, 1),
    },
  });
  // Format: CTR-2025-0001
  return `CTR-${currentYear}-${String(count + 1).padStart(4, "0")}`;
};

// ============================================
// CONTRACT CRUD
// ============================================

// @desc    Get all contracts
// @route   GET /api/contracts
// @access  Private
export const getContracts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    contractType,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
    includeArchived = false,
  } = req.query;

  const query = { venue: req.user.venueId };

  // Filters
  if (!includeArchived || includeArchived === "false") {
    query.isArchived = false; // Note: Check if 'isArchived' exists in your schema, otherwise remove this
  }
  if (status) query.status = status;
  if (contractType) query.contractType = contractType;

  // Search
  if (search) {
    query.$or = [
      { contractNumber: { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
      { "party.name": { $regex: search, $options: "i" } }, // Updated to nested field
      { "party.identifier": { $regex: search, $options: "i" } }, // Search by MF/CIN
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [contracts, total] = await Promise.all([
    Contract.find(query)
      .populate("event", "title startDate endDate type status")
      .populate("createdBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Contract.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      contracts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    })
  );
});

// @desc    Get single contract
// @route   GET /api/contracts/:id
// @access  Private
export const getContractById = asyncHandler(async (req, res) => {
  const contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  })
    .populate("event", "title startDate endDate startTime endTime type status guestCount pricing")
    .populate("createdBy", "name email");

  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  res.status(200).json(new ApiResponse(200, contract));
});

// @desc    Create contract
// @route   POST /api/contracts
// @access  Private
export const createContract = asyncHandler(async (req, res) => {
  const {
    contractType,
    eventId,
    title,
    party, // Now expects nested { type, name, identifier, ... }
    logistics, // { startDate, endDate, checkInTime... }
    financials, // { amountHT, vatRate, stampDuty... }
    paymentTerms,
    legal,
  } = req.body;

  // 1. Validate Party Data
  if (!party || !party.name || !party.identifier) {
    throw new ApiError(400, "Party details (Name & Identifier) are required");
  }

  // 2. Calculate Financials (Server-Side Integrity)
  const amountHT = Number(financials?.amountHT) || 0;
  const vatRate = Number(financials?.vatRate) || 19;
  const stampDuty = Number(financials?.stampDuty) || 1.000;
  
  const taxAmount = (amountHT * vatRate) / 100;
  const totalTTC = amountHT + taxAmount + stampDuty;

  const calculatedFinancials = {
    currency: financials?.currency || "TND",
    amountHT,
    vatRate,
    taxAmount,
    stampDuty,
    totalTTC,
  };

  // 3. Generate Contract Number
  const contractNumber = await generateContractNumber(req.user.venueId);

  // 4. Create
  const contract = await Contract.create({
    venue: req.user.venueId,
    contractNumber,
    contractType,
    event: eventId,
    title,
    party,
    logistics: {
        startDate: logistics.startDate,
        endDate: logistics.endDate,
        checkInTime: logistics.checkInTime,
        checkOutTime: logistics.checkOutTime
    },
    financials: calculatedFinancials,
    paymentTerms,
    legal,
    createdBy: req.user._id,
    status: "draft",
  });

  res.status(201).json(
    new ApiResponse(201, { contract }, "Contract created successfully")
  );
});

// @desc    Update contract
// @route   PUT /api/contracts/:id
// @access  Private
export const updateContract = asyncHandler(async (req, res) => {
  let contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  });

  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  if (contract.status === "signed" || contract.status === "cancelled") {
    throw new ApiError(400, "Cannot edit a signed or cancelled contract.");
  }

  // Recalculate financials if changed
  if (req.body.financials) {
    const amountHT = Number(req.body.financials.amountHT) || contract.financials.amountHT;
    const vatRate = Number(req.body.financials.vatRate) || contract.financials.vatRate;
    const stampDuty = Number(req.body.financials.stampDuty) || contract.financials.stampDuty;
    
    const taxAmount = (amountHT * vatRate) / 100;
    const totalTTC = amountHT + taxAmount + stampDuty;

    req.body.financials = {
        ...req.body.financials,
        taxAmount,
        totalTTC
    };
  }

  // Allow updates to specific fields structure
  const allowedUpdates = ["title", "party", "logistics", "financials", "paymentTerms", "legal", "status"];
  
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      contract[field] = req.body[field];
    }
  });

  // Version increment
  contract.version += 1;
  
  await contract.save();

  res.status(200).json(
    new ApiResponse(200, { contract }, "Contract updated successfully")
  );
});

// @desc    Delete contract
// @route   DELETE /api/contracts/:id
// @access  Private
export const deleteContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  });

  if (!contract) {
    throw new ApiError(404, "Contract not found");
  }

  if (contract.status === "signed") {
    throw new ApiError(400, "Cannot delete a signed contract.");
  }

  await contract.deleteOne();

  res.status(200).json(new ApiResponse(200, null, "Contract deleted successfully"));
});

// @desc    Archive contract (Soft Delete or Status Change)
// @route   PATCH /api/contracts/:id/archive
// @access  Private
export const archiveContract = asyncHandler(async (req, res) => {
  // Assuming you added an 'isArchived' field or rely on status
  // If Schema doesn't have isArchived, we might use a status or add the field.
  // Based on previous schema, I didn't add isArchived explicitly, usually status='cancelled' or similar is used, 
  // OR we can add isArchived to schema.
  
  // Let's assume we added 'isArchived' to the schema as per standard practice or use status.
  const contract = await Contract.findOneAndUpdate(
    { _id: req.params.id, venue: req.user.venueId },
    { status: 'cancelled' }, // Or isArchived: true if you added it
    { new: true }
  );

  if (!contract) throw new ApiError(404, "Contract not found");

  res.status(200).json(new ApiResponse(200, { contract }, "Contract archived"));
});

// @desc    Restore contract
// @route   PATCH /api/contracts/:id/restore
// @access  Private
export const restoreContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOneAndUpdate(
    { _id: req.params.id, venue: req.user.venueId },
    { status: 'draft' }, // Reset to draft
    { new: true }
  );

  if (!contract) throw new ApiError(404, "Contract not found");

  res.status(200).json(new ApiResponse(200, { contract }, "Contract restored"));
});

// ============================================
// CONTRACT ACTIONS
// ============================================

// @desc    Send contract for signing
// @route   POST /api/contracts/:id/send
// @access  Private
export const sendContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  });

  if (!contract) throw new ApiError(404, "Contract not found");
  if (contract.status !== "draft") throw new ApiError(400, "Only draft contracts can be sent");

  contract.status = "sent";
  // contract.sentAt = new Date(); // Add to schema if tracking is needed
  await contract.save();

  res.status(200).json(
    new ApiResponse(200, { contract }, "Contract sent successfully")
  );
});

// @desc    Mark contract as viewed
// @route   PATCH /api/contracts/:id/view
// @access  Public (with token ideally)
export const markContractViewed = asyncHandler(async (req, res) => {
  const contract = await Contract.findById(req.params.id);
  if (!contract) throw new ApiError(404, "Contract not found");

  if (contract.status === "sent") {
    contract.status = "viewed";
    await contract.save();
  }

  res.status(200).json(new ApiResponse(200, { contract }));
});

// @desc    Sign contract
// @route   POST /api/contracts/:id/sign
// @access  Private/Public
export const signContract = asyncHandler(async (req, res) => {
  const { signatureData, signerIp } = req.body; // Expecting minimal data for now

  const contract = await Contract.findById(req.params.id);
  if (!contract) throw new ApiError(404, "Contract not found");

  if (!["sent", "viewed"].includes(contract.status)) {
    throw new ApiError(400, "Contract is not ready for signing");
  }

  // Simplified signature logic
  contract.signatures = {
    ...contract.signatures,
    clientSignedAt: new Date(),
    clientSignerIp: signerIp || req.ip,
    digitalSignatureToken: signatureData // or hash
  };
  
  contract.status = "signed";
  await contract.save();

  res.status(200).json(
    new ApiResponse(200, { contract }, "Contract signed successfully")
  );
});

// @desc    Duplicate contract
// @route   POST /api/contracts/:id/duplicate
// @access  Private
export const duplicateContract = asyncHandler(async (req, res) => {
  const original = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  }).lean();

  if (!original) throw new ApiError(404, "Contract not found");

  // Clean up unique fields
  delete original._id;
  delete original.contractNumber;
  delete original.createdAt;
  delete original.updatedAt;
  delete original.signatures;
  delete original.__v;
  
  original.status = "draft";
  original.title = `${original.title} (Copie)`;
  original.contractNumber = await generateContractNumber(req.user.venueId);
  original.createdBy = req.user._id;

  const newContract = await Contract.create(original);

  res.status(201).json(
    new ApiResponse(201, { contract: newContract }, "Contract duplicated")
  );
});
// ============================================
// CONTRACT SETTINGS
// ============================================

// @desc    Get contract settings
// @route   GET /api/contracts/settings
// @access  Private
export const getContractSettings = asyncHandler(async (req, res) => {
  const settings = await ContractSettings.getOrCreate(req.user.venueId);
  res.status(200).json(new ApiResponse(200, { settings }));
});

// @desc    Update contract settings
// @route   PUT /api/contracts/settings
// @access  Private
export const updateContractSettings = asyncHandler(async (req, res) => {
  const settings = await ContractSettings.findOneAndUpdate(
    { venue: req.user.venueId },
    { $set: req.body },
    { new: true, upsert: true, runValidators: true }
  );
  res.status(200).json(new ApiResponse(200, { settings }, "Settings updated"));
});

// ============================================
// STATISTICS
// ============================================

// @desc    Get contract statistics
// @route   GET /api/contracts/stats
// @access  Private
export const getContractStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const stats = await Contract.aggregate([
    { $match: { venue: venueId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
        signed: { $sum: { $cond: [{ $eq: ["$status", "signed"] }, 1, 0] } },
        pendingSignatures: { 
            $sum: { $cond: [{ $in: ["$status", ["sent", "viewed"]] }, 1, 0] } 
        },
        totalValue: { $sum: "$financials.totalTTC" },
        signedValue: {
          $sum: { $cond: [{ $eq: ["$status", "signed"] }, "$financials.totalTTC", 0] },
        },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(200, stats[0] || { total: 0, draft: 0, signed: 0, pendingSignatures: 0, signedValue: 0 })
  );
});