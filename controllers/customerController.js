import Customer from "../models/Customer.js";
import User from "../models/User.js";
import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";

// 🔹 Create Customer
export const createCustomer = async (req, res) => {
  try {
    const userId = req.user._id; // <- logged-in user's business ID
    const businessId = req.user.businessId; // <- logged-in user's business ID

    const { name, person_name, phone_no, address } = req.body;

    // Create Customer
    const customer = await Customer.create({
      name,
      person_name,
      phone_no,
      address,
      userId,
      businessId,
    });

    req.audit = { action: "create", entity: "Customer", entityId: customer._id };
    res.status(201).json(customer);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(400).json({ message: error.message });
  }
};


// 🔹 Get All Customers with Balance
export const getCustomers = async (req, res) => {
  try {
    const businessId = req.user.businessId._id;
    const { page, limit, q } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : null;
    const limitNum = limit ? Math.max(1, parseInt(limit, 10)) : null;

    const matchStage = {
      businessId,
      ...(q
        ? {
            $or: [
              { name: { $regex: q, $options: "i" } },
              { person_name: { $regex: q, $options: "i" } },
              { phone_no: { $regex: q, $options: "i" } },
            ],
          }
        : {}),
    };

    if (pageNum && limitNum) {
      const [result] = await Customer.aggregate([
        { $match: matchStage },

        // ---- Invoices Total ----
        {
          $lookup: {
            from: "invoices",
            localField: "_id",
            foreignField: "customerId",
            as: "invoices",
          },
        },
        {
          $addFields: {
            totalInvoices: { $sum: "$invoices.netAmount" }
          }
        },

        // ---- Payments Total ----
        {
          $lookup: {
            from: "payments",
            localField: "_id",
            foreignField: "customerId",
            as: "payments",
          },
        },
        {
          $addFields: {
            totalPayments: { $sum: "$payments.amount" }
          }
        },

        // ---- Final Balance ----
        {
          $addFields: {
            balance: {
              $subtract: ["$totalInvoices", "$totalPayments"]
            }
          }
        },

        // ---- Clean extra arrays ----
        {
          $project: {
            invoices: 0,
            payments: 0
          }
        },
        {
          $facet: {
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: (pageNum - 1) * limitNum },
              { $limit: limitNum }
            ],
            totalCount: [{ $count: "count" }]
          }
        }
      ]);

      const total = result?.totalCount?.[0]?.count || 0;
      return res.status(200).json({
        data: result?.data || [],
        page: pageNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    const customers = await Customer.aggregate([
      { $match: matchStage },

      // ---- Invoices Total ----
      {
        $lookup: {
          from: "invoices",
          localField: "_id",
          foreignField: "customerId",
          as: "invoices",
        },
      },
      {
        $addFields: {
          totalInvoices: { $sum: "$invoices.netAmount" }
        }
      },

      // ---- Payments Total ----
      {
        $lookup: {
          from: "payments",
          localField: "_id",
          foreignField: "customerId",
          as: "payments",
        },
      },
      {
        $addFields: {
          totalPayments: { $sum: "$payments.amount" }
        }
      },

      // ---- Final Balance ----
      {
        $addFields: {
          balance: {
            $subtract: ["$totalInvoices", "$totalPayments"]
          }
        }
      },

      // ---- Clean extra arrays ----
      {
        $project: {
          invoices: 0,
          payments: 0
        }
      }
    ]);

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Get Single Customer by ID
export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      businessId: req.user.businessId,
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.status(200).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Update Customer (optionally update linked user)
export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      businessId: req.user.businessId,
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // Update linked user if username or password provided
    if (req.body.username || req.body.password) {
      const user = await User.findById(customer.userId);
      if (req.body.username) user.username = req.body.username;
      if (req.body.password) user.password = req.body.password;
      await user.save();
    }

    Object.assign(customer, req.body);
    await customer.save();

    req.audit = { action: "update", entity: "Customer", entityId: customer._id };
    res.status(200).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 🔹 Delete Customer + linked user
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      businessId: req.user.businessId,
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    await User.findByIdAndDelete(customer.userId); // remove linked user
    await customer.remove();

    req.audit = { action: "delete", entity: "Customer", entityId: customer._id };
    res.status(200).json({ message: "Customer and linked user deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Toggle Active Status
export const toggleCustomerStatus = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      businessId: req.user.businessId,
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    customer.isActive = !customer.isActive;
    await customer.save();

    req.audit = { action: "toggle", entity: "Customer", entityId: customer._id };
    res.status(200).json({
      message: `Customer is now ${customer.isActive ? "Active" : "Inactive"}`,
      customer,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Generate Statement with dynamic opening balance
export const generateStatement = async (req, res) => {
  try {
    const customerId = req.params.id;
    const businessId = req.user.businessId;
    let { date_from, date_to } = req.body;

    const customer = await Customer.findOne({ _id: customerId, businessId });
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    // 1️⃣ Parse dates safely and normalize to start/end of day
    let fromDateObj = date_from ? new Date(date_from) : null;
    let toDateObj = date_to ? new Date(date_to) : new Date();

    if (fromDateObj) fromDateObj.setHours(0, 0, 0, 0); // start of fromDate
    if (toDateObj) toDateObj.setHours(23, 59, 59, 999); // end of toDate

    // 2️⃣ Calculate Opening Balance (strictly before fromDate)
    let openingBalance = 0;
    if (fromDateObj) {
      const pastInvoices = await Invoice.find({
        customerId,
        businessId,
        createdAt: { $lt: fromDateObj },
      });
      const pastPayments = await Payment.find({
        customerId,
        businessId,
        date: { $lt: fromDateObj },
      });

      const totalPastInvoices = pastInvoices.reduce((sum, inv) => sum + (inv.netAmount || 0), 0);
      const totalPastPayments = pastPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);

      openingBalance = totalPastInvoices - totalPastPayments;
    }

    // 3️⃣ Fetch ledger data (between fromDate and toDate inclusive)
    const invoiceQuery = {
      customerId,
      businessId,
      ...(fromDateObj || toDateObj ? { createdAt: { ...(fromDateObj ? { $gte: fromDateObj } : {}), ...(toDateObj ? { $lte: toDateObj } : {}) } } : {}),
    };
    const invoices = await Invoice.find(invoiceQuery).sort({ createdAt: 1 });

    const paymentQuery = {
      customerId,
      businessId,
      ...(fromDateObj || toDateObj ? { date: { ...(fromDateObj ? { $gte: fromDateObj } : {}), ...(toDateObj ? { $lte: toDateObj } : {}) } } : {}),
    };
    const payments = await Payment.find(paymentQuery).sort({ date: 1 });

    // 4️⃣ Combine ledger
    const ledger = [
      ...invoices.map(inv => ({
        type: "Invoice",
        amount: inv.netAmount || 0,
        date: inv.createdAt,
        createdAt: inv.createdAt,
        debit: inv.netAmount || 0,
        credit: 0,
        ref: inv.invoiceNumber,
      })),
      ...payments.map(pay => ({
        type: "Payment",
        amount: pay.amount || 0,
        date: pay.date,
        createdAt: pay.createdAt,
        debit: 0,
        credit: pay.amount || 0,
        ref: pay.cheque_no || pay.slip_no || pay.transaction_id || '-',
      })),
    ];

    // Sort ledger by date, then by createdAt (older first, newest last)
    ledger.sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      const createdDiff = new Date(a.createdAt) - new Date(b.createdAt);
      if (createdDiff !== 0) return createdDiff;
      return 0;
    });

    // 5️⃣ Calculate running balance
    let balance = openingBalance;
    ledger.forEach(row => {
      balance += row.debit - row.credit;
      row.balance = balance;
    });

    // 6️⃣ Summary totals
    const totalInvoices = invoices.reduce((sum, i) => sum + (i.netAmount || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const closingBalance = balance;

    res.status(200).json({
      dates: { from: date_from, to: date_to },
      customer: { id: customer._id, name: customer.name, phone_no: customer.phone_no },
      totals: { openingBalance, totalInvoices, totalPayments, closingBalance },
      ledger,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
