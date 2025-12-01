import Contract from "../models/Contract.js";
import ContractSettings from "../models/ContractSettings.js";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import Venue from "../models/Venue.js";
import { generateContractPDF } from "../utils/generateContractPDF.js";

// ============================================
// HELPER: Generate Contract Number based on Settings
// ============================================
const generateContractNumber = async (venueId) => {
  // 1. Fetch Settings
  const settings = await ContractSettings.findOne({ venue: venueId });
  const structure = settings?.structure || {
    prefix: "CTR",
    separator: "-",
    includeYear: true,
    yearFormat: "YYYY",
    sequenceDigits: 4,
    resetSequenceYearly: true
  };

  const date = new Date();
  const yearFull = date.getFullYear();
  const yearShort = yearFull.toString().slice(-2);
  const yearToUse = structure.yearFormat === "YY" ? yearShort : yearFull;

  // 2. Count existing docs for this year/sequence
  const query = { venue: venueId };
  if (structure.includeYear && structure.resetSequenceYearly) {
    query.createdAt = {
      $gte: new Date(yearFull, 0, 1),
      $lt: new Date(yearFull + 1, 0, 1),
    };
  }

  const count = await Contract.countDocuments(query);
  const nextNum = count + 1;
  const sequence = String(nextNum).padStart(structure.sequenceDigits || 4, "0");

  // 3. Build String
  let contractNumber = structure.prefix || "CTR";
  if (structure.separator) contractNumber += structure.separator;
  if (structure.includeYear) {
    contractNumber += yearToUse;
    if (structure.separator) contractNumber += structure.separator;
  }
  contractNumber += sequence;

  return contractNumber;
};

// Helper: Recalculate Financials based on Services
const calculateFinancials = (services, vatRate = 19, stampDuty = 1.0) => {
  const amountHT = services.reduce((acc, item) => {
    const lineAmount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    return acc + lineAmount;
  }, 0);

  const taxAmount = (amountHT * Number(vatRate)) / 100;
  const totalTTC = amountHT + taxAmount + Number(stampDuty);

  return {
    amountHT,
    taxAmount,
    totalTTC,
    vatRate: Number(vatRate),
    stampDuty: Number(stampDuty),
  };
};

// ============================================
// CRUD OPERATIONS
// ============================================

// @desc    Get all contracts
// @route   GET /api/contracts
export const getContracts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    contractType,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query = { venue: req.user.venueId };

  if (status) query.status = status;
  if (contractType) query.contractType = contractType;

  if (search) {
    query.$or = [
      { contractNumber: { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
      { "party.name": { $regex: search, $options: "i" } },
      { "party.identifier": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [contracts, total] = await Promise.all([
    Contract.find(query)
      .populate("event", "title startDate endDate")
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
export const getContractById = asyncHandler(async (req, res) => {
  const contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  })
    .populate("event", "title startDate endDate type")
    .populate("createdBy", "name email");

  if (!contract) throw new ApiError(404, "Contract not found");

  res.status(200).json(new ApiResponse(200, { contract }));
});

// @desc    Create contract
// @route   POST /api/contracts
export const createContract = asyncHandler(async (req, res) => {
  const {
    contractType,
    eventId,
    title,
    party,
    logistics,
    services,
    financials,
    paymentTerms,
    legal,
  } = req.body;

  if (!party || !party.name) {
    throw new ApiError(400, "Party details are required");
  }

  const safeServices = Array.isArray(services) ? services : [];

  const processedServices = safeServices.map((s) => ({
    description: s.description || "Service",
    quantity: Number(s.quantity) || 1,
    rate: Number(s.rate) || 0,
    amount: (Number(s.quantity) || 1) * (Number(s.rate) || 0),
  }));

  const calculatedStats = calculateFinancials(
    processedServices,
    financials?.vatRate,
    financials?.stampDuty
  );

  const finalFinancials = {
    currency: financials?.currency || "TND",
    ...calculatedStats,
  };

  const contractNumber = await generateContractNumber(req.user.venueId);

  const contract = await Contract.create({
    venue: req.user.venueId,
    contractNumber,
    contractType,
    event: eventId || undefined,
    title,
    party,
    logistics,
    services: processedServices,
    financials: finalFinancials,
    paymentTerms,
    legal,
    createdBy: req.user._id,
    status: "draft",
  });

  res
    .status(201)
    .json(new ApiResponse(201, { contract }, "Contract created successfully"));
});

// @desc    Update contract
// @route   PUT /api/contracts/:id
export const updateContract = asyncHandler(async (req, res) => {
  let contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  });

  if (!contract) throw new ApiError(404, "Contract not found");
  if (["signed", "cancelled", "expired"].includes(contract.status)) {
    throw new ApiError(400, "Cannot edit a finalized contract.");
  }

  // Handle Services & Financials Update
  if (req.body.services || req.body.financials) {
    const servicesInput = req.body.services || contract.services;
    const processedServices = servicesInput.map((s) => ({
      description: s.description,
      quantity: Number(s.quantity) || 0,
      rate: Number(s.rate) || 0,
      amount: (Number(s.quantity) || 0) * (Number(s.rate) || 0),
    }));

    const vatRate =
      req.body.financials?.vatRate !== undefined
        ? req.body.financials.vatRate
        : contract.financials.vatRate;

    const stampDuty =
      req.body.financials?.stampDuty !== undefined
        ? req.body.financials.stampDuty
        : contract.financials.stampDuty;

    const calculatedStats = calculateFinancials(
      processedServices,
      vatRate,
      stampDuty
    );

    contract.services = processedServices;
    contract.financials = {
      ...contract.financials.toObject(),
      ...calculatedStats,
    };
  }

  const allowedUpdates = [
    "title",
    "party",
    "logistics",
    "paymentTerms",
    "legal",
    "status",
    "event",
  ];
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      contract[field] = req.body[field];
    }
  });

  contract.version += 1;
  await contract.save();

  res
    .status(200)
    .json(new ApiResponse(200, { contract }, "Contract updated successfully"));
});

// @desc    Delete contract
// @route   DELETE /api/contracts/:id
export const deleteContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  });

  if (!contract) throw new ApiError(404, "Contract not found");
  if (contract.status === "signed")
    throw new ApiError(400, "Cannot delete signed contract");

  await contract.deleteOne();
  res.status(200).json(new ApiResponse(200, null, "Contract deleted"));
});

// ============================================
// ARCHIVE & RESTORE
// ============================================

// @desc    Archive contract
// @route   PATCH /api/contracts/:id/archive
export const archiveContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOneAndUpdate(
    { _id: req.params.id, venue: req.user.venueId },
    { status: "cancelled" },
    { new: true }
  );

  if (!contract) throw new ApiError(404, "Contract not found");

  res.status(200).json(new ApiResponse(200, { contract }, "Contract archived"));
});

// @desc    Restore contract
// @route   PATCH /api/contracts/:id/restore
export const restoreContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOneAndUpdate(
    { _id: req.params.id, venue: req.user.venueId },
    { status: "draft" },
    { new: true }
  );

  if (!contract) throw new ApiError(404, "Contract not found");

  res.status(200).json(new ApiResponse(200, { contract }, "Contract restored"));
});

// ============================================
// ACTIONS
// ============================================

// @desc    Send contract
// @route   POST /api/contracts/:id/send
export const sendContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  });
  if (!contract) throw new ApiError(404, "Contract not found");

  contract.status = "sent";
  await contract.save();

  res.status(200).json(new ApiResponse(200, { contract }, "Contract sent"));
});

// @desc    Duplicate contract
// @route   POST /api/contracts/:id/duplicate
export const duplicateContract = asyncHandler(async (req, res) => {
  const original = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  }).lean();

  if (!original) throw new ApiError(404, "Contract not found");

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

  res
    .status(201)
    .json(new ApiResponse(201, { contract: newContract }, "Contract duplicated"));
});

// @desc    Mark contract as viewed
// @route   PATCH /api/contracts/:id/view
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
export const signContract = asyncHandler(async (req, res) => {
  const { signatureData, signerIp } = req.body;

  const contract = await Contract.findById(req.params.id);
  if (!contract) throw new ApiError(404, "Contract not found");

  contract.signatures = {
    ...contract.signatures,
    clientSignedAt: new Date(),
    clientSignerIp: signerIp || req.ip,
    digitalSignatureToken: signatureData,
  };

  contract.status = "signed";
  await contract.save();

  res
    .status(200)
    .json(new ApiResponse(200, { contract }, "Contract signed successfully"));
});

// ============================================
// SETTINGS
// ============================================

// @desc    Get contract settings
// @route   GET /api/contracts/settings
export const getContractSettings = asyncHandler(async (req, res) => {
  const settings = await ContractSettings.getOrCreate(req.user.venueId);
  res.status(200).json(new ApiResponse(200, { settings }));
});

// @desc    Update contract settings
// @route   PUT /api/contracts/settings
export const updateContractSettings = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  // 1. Find existing settings
  let settings = await ContractSettings.findOne({ venue: venueId });

  if (!settings) {
    settings = await ContractSettings.getOrCreate(venueId);
  }

  // 2. Update fields directly on the document
  const fieldsToUpdate = [
    "companyInfo",
    "branding",
    "layout",
    "financialDefaults",
    "defaultSections",
    "defaultCancellationPolicy",
    "labels",
    "structure",
    "signatureSettings",
    "emailTemplates",
  ];

  for (const field of fieldsToUpdate) {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field];
    }
  }

  // 3. Save with validation disabled for speed
  await settings.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(new ApiResponse(200, { settings }, "Settings updated successfully"));
});

// ============================================
// STATS & DOWNLOAD
// ============================================

// @desc    Get contract stats
// @route   GET /api/contracts/stats
export const getContractStats = asyncHandler(async (req, res) => {
  const stats = await Contract.aggregate([
    { $match: { venue: req.user.venueId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        draft: {
          $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
        },
        sent: {
          $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] },
        },
        viewed: {
          $sum: { $cond: [{ $eq: ["$status", "viewed"] }, 1, 0] },
        },
        signed: {
          $sum: { $cond: [{ $eq: ["$status", "signed"] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
        pendingSignatures: {
          $sum: { $cond: [{ $in: ["$status", ["sent", "viewed"]] }, 1, 0] },
        },
        revenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "signed"] },
                  { $eq: ["$contractType", "client"] },
                ],
              },
              "$financials.totalTTC",
              0,
            ],
          },
        },
        expenses: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "signed"] },
                  { $eq: ["$contractType", "partner"] },
                ],
              },
              "$financials.totalTTC",
              0,
            ],
          },
        },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      stats[0] || {
        total: 0,
        draft: 0,
        sent: 0,
        viewed: 0,
        signed: 0,
        cancelled: 0,
        pendingSignatures: 0,
        revenue: 0,
        expenses: 0,
      }
    )
  );
});

// @desc    Download PDF
// @route   GET /api/contracts/:id/download
export const downloadContractPdf = asyncHandler(async (req, res) => {
  // 1. Fetch Contract
  const contract = await Contract.findOne({
    _id: req.params.id,
    venue: req.user.venueId,
  });

  if (!contract) throw new ApiError(404, "Contract not found");

  // 2. Fetch Settings (for styling)
  const settings = await ContractSettings.findOne({ venue: req.user.venueId });

  // 3. Fetch Venue (for fallback info)
  const venue = await Venue.findById(req.user.venueId);

  // 4. Generate PDF
  const pdfBuffer = await generateContractPDF(contract, venue, settings);

  // 5. Send Response
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=contract-${contract.contractNumber}.pdf`
  );
  res.setHeader("Content-Length", pdfBuffer.length);

  res.send(pdfBuffer);
});