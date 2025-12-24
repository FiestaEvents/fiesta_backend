// src/controllers/financeController.js
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { Finance, Event, Partner } = require("../models/index");

/**
 * @desc    Get all finance records (non-archived by default)
 * @route   GET /api/v1/finance
 * @access  Private
 */
exports.getFinanceRecords = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    category,
    status,
    startDate,
    endDate,
    search,
    sortBy = "date",
    order = "desc",
    includeArchived = false,
  } = req.query;

  // Build query scoped to Business
  const query = { businessId: req.business._id };

  if (type) query.type = type;
  if (category) query.category = category;
  if (status) query.status = status;
  
  if (!includeArchived) {
    query.isArchived = false;
  }

  // Date range filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  // Search by description or reference
  if (search) {
    query.$or = [
      { description: { $regex: search, $options: "i" } },
      { reference: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const sortOrder = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortOrder };

  const [records, total] = await Promise.all([
    Finance.find(query)
      .populate("relatedEvent", "title startDate")
      .populate("relatedPartner", "name category")
      .populate("createdBy", "name email")
      .populate("archivedBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Finance.countDocuments(query),
  ]);

  new ApiResponse({
    records,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single finance record (including archived)
 * @route   GET /api/v1/finance/:id
 * @access  Private
 */
exports.getFinanceRecord = asyncHandler(async (req, res) => {
  const record = await Finance.findOne({
    _id: req.params.id,
    businessId: req.business._id,
  })
    .populate("relatedEvent")
    .populate("relatedPartner")
    .populate("createdBy", "name email")
    .populate("archivedBy", "name email");

  if (!record) {
    throw new ApiError("Finance record not found", 404);
  }

  new ApiResponse({ record }).send(res);
});

/**
 * @desc    Create new finance record
 * @route   POST /api/v1/finance
 * @access  Private (finance.create)
 */
exports.createFinanceRecord = asyncHandler(async (req, res) => {
  const recordData = {
    ...req.body,
    businessId: req.business._id, // Updated
    createdBy: req.user._id,
    isArchived: false,
  };

  // Verify related event if provided
  if (recordData.relatedEvent) {
    const event = await Event.findOne({
      _id: recordData.relatedEvent,
      businessId: req.business._id, // Updated
    });

    if (!event) {
      throw new ApiError("Related event not found", 404);
    }
  }

  // Verify related partner if provided
  if (recordData.relatedPartner) {
    const partner = await Partner.findOne({
      _id: recordData.relatedPartner,
      businessId: req.business._id, // Updated
    });

    if (!partner) {
      throw new ApiError("Related partner not found", 404);
    }
  }

  // Validate category requirements
  if (recordData.category === "event_revenue" && !recordData.relatedEvent) {
    throw new ApiError("Event revenue must be linked to an event", 400);
  }

  if (recordData.category === "partner_payment" && !recordData.relatedPartner) {
    throw new ApiError("Partner payment must be linked to a partner", 400);
  }

  const record = await Finance.create(recordData);

  await record.populate([
    { path: "relatedEvent", select: "title startDate" },
    { path: "relatedPartner", select: "name category" },
  ]);

  new ApiResponse({ record }, "Finance record created successfully", 201).send(res);
});

/**
 * @desc    Update finance record
 * @route   PUT /api/v1/finance/:id
 * @access  Private (finance.update.all)
 */
exports.updateFinanceRecord = asyncHandler(async (req, res) => {
  const record = await Finance.findOne({
    _id: req.params.id,
    businessId: req.business._id,
  });

  if (!record) {
    throw new ApiError("Finance record not found", 404);
  }

  if (record.isArchived) {
    throw new ApiError("Cannot update an archived finance record", 400);
  }

  // Verify related resources if being changed
  if (req.body.relatedEvent) {
    const event = await Event.findOne({
      _id: req.body.relatedEvent,
      businessId: req.business._id,
    });
    if (!event) throw new ApiError("Related event not found", 404);
  }

  if (req.body.relatedPartner) {
    const partner = await Partner.findOne({
      _id: req.body.relatedPartner,
      businessId: req.business._id,
    });
    if (!partner) throw new ApiError("Related partner not found", 404);
  }

  Object.assign(record, req.body);
  await record.save();

  await record.populate([
    { path: "relatedEvent", select: "title startDate" },
    { path: "relatedPartner", select: "name category" },
  ]);

  new ApiResponse({ record }, "Finance record updated successfully").send(res);
});

/**
 * @desc    Archive finance record (soft delete)
 * @route   DELETE /api/v1/finance/:id
 * @access  Private (finance.delete.all)
 */
exports.deleteFinanceRecord = asyncHandler(async (req, res) => {
  const record = await Finance.findOne({
    _id: req.params.id,
    businessId: req.business._id,
  });

  if (!record) {
    throw new ApiError("Finance record not found", 404);
  }

  if (record.isArchived) {
    throw new ApiError("Finance record is already archived", 400);
  }

  // Soft delete
  record.isArchived = true;
  record.archivedAt = new Date();
  record.archivedBy = req.user._id;
  await record.save();

  new ApiResponse(null, "Finance record archived successfully").send(res);
});

/**
 * @desc    Restore archived finance record
 * @route   PATCH /api/v1/finance/:id/restore
 * @access  Private (finance.update.all)
 */
exports.restoreFinanceRecord = asyncHandler(async (req, res) => {
  const record = await Finance.findOne({
    _id: req.params.id,
    businessId: req.business._id,
  });

  if (!record) {
    throw new ApiError("Finance record not found", 404);
  }

  if (!record.isArchived) {
    throw new ApiError("Finance record is not archived", 400);
  }

  record.isArchived = false;
  record.archivedAt = undefined;
  record.archivedBy = undefined;
  await record.save();

  await record.populate([
    { path: "relatedEvent", select: "title startDate" },
    { path: "relatedPartner", select: "name category" },
  ]);

  new ApiResponse({ record }, "Finance record restored successfully").send(res);
});

/**
 * @desc    Get archived finance records
 * @route   GET /api/v1/finance/archived
 * @access  Private
 */
exports.getArchivedFinanceRecords = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    category,
    sortBy = "archivedAt",
    order = "desc",
  } = req.query;

  const query = { 
    businessId: req.business._id,
    isArchived: true 
  };

  if (type) query.type = type;
  if (category) query.category = category;

  const skip = (page - 1) * limit;
  const sortOrder = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortOrder };

  const [records, total] = await Promise.all([
    Finance.find(query)
      .populate("relatedEvent", "title startDate")
      .populate("relatedPartner", "name category")
      .populate("createdBy", "name email")
      .populate("archivedBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Finance.countDocuments(query),
  ]);

  new ApiResponse({
    records,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get financial summary (non-archived only)
 * @route   GET /api/v1/finance/summary
 * @access  Private
 */
exports.getFinancialSummary = asyncHandler(async (req, res) => {
  const businessId = req.business._id;
  const { startDate, endDate, groupBy = "month" } = req.query;

  const dateFilter = { 
    businessId, 
    status: "completed",
    isArchived: false 
  };
  
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = new Date(startDate);
    if (endDate) dateFilter.date.$lte = new Date(endDate);
  }

  // Summary by type
  const summary = await Finance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
        avgAmount: { $avg: "$amount" },
      },
    },
  ]);

  // Summary by category
  const categoryBreakdown = await Finance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: {
          type: "$type",
          category: "$category",
        },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  // Time series
  let groupByFormat;
  switch (groupBy) {
    case "day":
      groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
      break;
    case "week":
      groupByFormat = {
        year: { $year: "$date" },
        week: { $isoWeek: "$date" },
      };
      break;
    case "year":
      groupByFormat = { $year: "$date" };
      break;
    default: // month
      groupByFormat = { $dateToString: { format: "%Y-%m", date: "$date" } };
  }

  const timeSeries = await Finance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: {
          period: groupByFormat,
          type: "$type",
        },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.period": 1 } },
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let archivedCount = 0;

  summary.forEach((item) => {
    if (item._id === "income") {
      totalIncome = item.totalAmount;
      incomeCount = item.count;
    }
    if (item._id === "expense") {
      totalExpense = item.totalAmount;
      expenseCount = item.count;
    }
  });

  archivedCount = await Finance.countDocuments({
    businessId,
    isArchived: true,
  });

  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;

  // Top expense categories
  const topExpenses = await Finance.aggregate([
    { $match: { ...dateFilter, type: "expense" } },
    {
      $group: {
        _id: "$category",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
    { $limit: 5 },
  ]);

  // Top income categories
  const topIncome = await Finance.aggregate([
    { $match: { ...dateFilter, type: "income" } },
    {
      $group: {
        _id: "$category",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
    { $limit: 5 },
  ]);

  new ApiResponse({
    summary: {
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin: parseFloat(profitMargin),
      incomeCount,
      expenseCount,
      archivedCount,
      totalTransactions: incomeCount + expenseCount,
    },
    categoryBreakdown,
    timeSeries,
    topExpenses,
    topIncome,
  }).send(res);
});

/**
 * @desc    Get cash flow report (non-archived only)
 * @route   GET /api/v1/finance/cashflow
 * @access  Private
 */
exports.getCashFlowReport = asyncHandler(async (req, res) => {
  const businessId = req.business._id;
  const { startDate, endDate, groupBy = "month" } = req.query;

  const dateFilter = { 
    businessId, 
    status: "completed",
    isArchived: false
  };
  
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = new Date(startDate);
    if (endDate) dateFilter.date.$lte = new Date(endDate);
  }

  let groupByFormat;
  switch (groupBy) {
    case "day":
      groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
      break;
    case "week":
      groupByFormat = {
        $concat: [
          { $toString: { $year: "$date" } },
          "-W",
          {
            $toString: {
              $cond: {
                if: { $lt: [{ $isoWeek: "$date" }, 10] },
                then: { $concat: ["0", { $toString: { $isoWeek: "$date" } }] },
                else: { $toString: { $isoWeek: "$date" } },
              },
            },
          },
        ],
      };
      break;
    case "year":
      groupByFormat = { $toString: { $year: "$date" } };
      break;
    default: // month
      groupByFormat = { $dateToString: { format: "%Y-%m", date: "$date" } };
  }

  const cashFlow = await Finance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: {
          period: groupByFormat,
          type: "$type",
        },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.period": 1 } },
  ]);

  const cashFlowByPeriod = {};
  let runningBalance = 0;

  cashFlow.forEach((item) => {
    const period = item._id.period;
    if (!cashFlowByPeriod[period]) {
      cashFlowByPeriod[period] = {
        period,
        income: 0,
        expense: 0,
        net: 0,
        balance: 0,
      };
    }

    if (item._id.type === "income") {
      cashFlowByPeriod[period].income = item.amount;
    } else {
      cashFlowByPeriod[period].expense = item.amount;
    }
  });

  const cashFlowArray = Object.values(cashFlowByPeriod).sort((a, b) =>
    a.period.localeCompare(b.period)
  );

  cashFlowArray.forEach((period) => {
    period.net = period.income - period.expense;
    runningBalance += period.net;
    period.balance = runningBalance;
  });

  if (cashFlowArray.length >= 2) {
    const currentPeriod = cashFlowArray[cashFlowArray.length - 1];
    const previousPeriod = cashFlowArray[cashFlowArray.length - 2];

    const growthRate =
      previousPeriod.net !== 0
        ? (((currentPeriod.net - previousPeriod.net) / Math.abs(previousPeriod.net)) * 100).toFixed(2)
        : 0;

    currentPeriod.growthRate = parseFloat(growthRate);
  }

  new ApiResponse({
    cashFlow: cashFlowArray,
    currentBalance: runningBalance,
  }).send(res);
});

/**
 * @desc    Get expense breakdown by category
 * @route   GET /api/v1/finance/expenses/breakdown
 * @access  Private
 */
exports.getExpenseBreakdown = asyncHandler(async (req, res) => {
  const businessId = req.business._id;
  const { startDate, endDate } = req.query;

  const dateFilter = { 
    businessId, 
    type: "expense", 
    status: "completed",
    isArchived: false 
  };
  
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = new Date(startDate);
    if (endDate) dateFilter.date.$lte = new Date(endDate);
  }

  const breakdown = await Finance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$category",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
        avgAmount: { $avg: "$amount" },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  const totalExpenses = breakdown.reduce((sum, item) => sum + item.totalAmount, 0);

  const breakdownWithPercentages = breakdown.map((item) => ({
    category: item._id,
    totalAmount: item.totalAmount,
    count: item.count,
    avgAmount: item.avgAmount,
    percentage: totalExpenses > 0 ? ((item.totalAmount / totalExpenses) * 100).toFixed(2) : 0,
  }));

  new ApiResponse({
    breakdown: breakdownWithPercentages,
    totalExpenses,
  }).send(res);
});

/**
 * @desc    Get income breakdown by category
 * @route   GET /api/v1/finance/income/breakdown
 * @access  Private
 */
exports.getIncomeBreakdown = asyncHandler(async (req, res) => {
  const businessId = req.business._id;
  const { startDate, endDate } = req.query;

  const dateFilter = { 
    businessId, 
    type: "income", 
    status: "completed",
    isArchived: false
  };
  
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = new Date(startDate);
    if (endDate) dateFilter.date.$lte = new Date(endDate);
  }

  const breakdown = await Finance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$category",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
        avgAmount: { $avg: "$amount" },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  const totalIncome = breakdown.reduce((sum, item) => sum + item.totalAmount, 0);

  const breakdownWithPercentages = breakdown.map((item) => ({
    category: item._id,
    totalAmount: item.totalAmount,
    count: item.count,
    avgAmount: item.avgAmount,
    percentage: totalIncome > 0 ? ((item.totalAmount / totalIncome) * 100).toFixed(2) : 0,
  }));

  new ApiResponse({
    breakdown: breakdownWithPercentages,
    totalIncome,
  }).send(res);
});

/**
 * @desc    Get profit and loss statement
 * @route   GET /api/v1/finance/profit-loss
 * @access  Private
 */
exports.getProfitLossStatement = asyncHandler(async (req, res) => {
  const businessId = req.business._id;
  const { startDate, endDate } = req.query;

  const dateFilter = { 
    businessId, 
    status: "completed",
    isArchived: false 
  };
  
  if (startDate || endDate) {
    dateFilter.date = {};
    if (startDate) dateFilter.date.$gte = new Date(startDate);
    if (endDate) dateFilter.date.$lte = new Date(endDate);
  }

  const incomeByCategory = await Finance.aggregate([
    { $match: { ...dateFilter, type: "income" } },
    {
      $group: {
        _id: "$category",
        amount: { $sum: "$amount" },
      },
    },
  ]);

  const expensesByCategory = await Finance.aggregate([
    { $match: { ...dateFilter, type: "expense" } },
    {
      $group: {
        _id: "$category",
        amount: { $sum: "$amount" },
      },
    },
  ]);

  const totalRevenue = incomeByCategory.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expensesByCategory.reduce((sum, item) => sum + item.amount, 0);

  // Operating expenses vs direct costs
  const operatingExpenses = expensesByCategory
    .filter((e) =>
      ["utilities", "maintenance", "marketing", "staff_salary", "insurance", "taxes"].includes(
        e._id
      )
    )
    .reduce((sum, item) => sum + item.amount, 0);

  const directCosts = expensesByCategory
    .filter((e) => ["partner_payment", "equipment", "supplies", "fuel"].includes(e._id))
    .reduce((sum, item) => sum + item.amount, 0);

  const grossProfit = totalRevenue - directCosts;
  const operatingIncome = grossProfit - operatingExpenses;
  const netIncome = totalRevenue - totalExpenses;

  const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0;
  const operatingMargin =
    totalRevenue > 0 ? ((operatingIncome / totalRevenue) * 100).toFixed(2) : 0;
  const netMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : 0;

  new ApiResponse({
    revenue: {
      byCategory: incomeByCategory,
      total: totalRevenue,
    },
    expenses: {
      byCategory: expensesByCategory,
      directCosts,
      operatingExpenses,
      total: totalExpenses,
    },
    profitability: {
      grossProfit,
      grossMargin: parseFloat(grossMargin),
      operatingIncome,
      operatingMargin: parseFloat(operatingMargin),
      netIncome,
      netMargin: parseFloat(netMargin),
    },
  }).send(res);
});

/**
 * @desc    Get financial trends
 * @route   GET /api/v1/finance/trends
 * @access  Private
 */
exports.getFinancialTrends = asyncHandler(async (req, res) => {
  const businessId = req.business._id;
  const { months = 12 } = req.query;

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  const trends = await Finance.aggregate([
    {
      $match: {
        businessId,
        status: "completed",
        isArchived: false,
        date: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$date" } },
          type: "$type",
        },
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.month": 1 } },
  ]);

  const trendsByMonth = {};

  trends.forEach((item) => {
    const month = item._id.month;
    if (!trendsByMonth[month]) {
      trendsByMonth[month] = { month, income: 0, expense: 0, net: 0 };
    }

    if (item._id.type === "income") {
      trendsByMonth[month].income = item.amount;
    } else {
      trendsByMonth[month].expense = item.amount;
    }
  });

  const trendsArray = Object.values(trendsByMonth).map((month) => {
    month.net = month.income - month.expense;
    return month;
  });

  // Calculate moving average (3-month)
  trendsArray.forEach((month, index) => {
    if (index >= 2) {
      const sum =
        trendsArray[index].net + trendsArray[index - 1].net + trendsArray[index - 2].net;
      month.movingAverage = (sum / 3).toFixed(2);
    }
  });

  new ApiResponse({ trends: trendsArray }).send(res);
});

/**
 * @desc    Get tax summary
 * @route   GET /api/v1/finance/tax-summary
 * @access  Private
 */
exports.getTaxSummary = asyncHandler(async (req, res) => {
  const businessId = req.business._id;
  const { year } = req.query;

  const currentYear = year || new Date().getFullYear();
  const startDate = new Date(`${currentYear}-01-01`);
  const endDate = new Date(`${currentYear}-12-31`);

  const taxData = await Finance.aggregate([
    {
      $match: {
        businessId,
        status: "completed",
        isArchived: false,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amount" },
        totalTax: { $sum: "$taxInfo.taxAmount" },
      },
    },
  ]);

  const taxRecords = await Finance.find({
    businessId,
    category: "taxes",
    date: { $gte: startDate, $lte: endDate },
    isArchived: false,
  }).sort({ date: -1 });

  let totalIncome = 0;
  let totalExpense = 0;
  let totalTaxPaid = 0;

  taxData.forEach((item) => {
    if (item._id === "income") totalIncome = item.totalAmount;
    if (item._id === "expense") totalExpense = item.totalAmount;
  });

  totalTaxPaid = taxRecords.reduce((sum, record) => sum + record.amount, 0);

  const taxableIncome = totalIncome - totalExpense;

  new ApiResponse({
    year: currentYear,
    totalIncome,
    totalExpense,
    taxableIncome,
    totalTaxPaid,
    taxRecords,
  }).send(res);
});