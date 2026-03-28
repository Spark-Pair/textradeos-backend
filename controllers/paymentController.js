import Payment from "../models/Payment.js";
import Customer from "../models/Customer.js";

export const createPayment = async (req, res) => {
  try {
    const userId = req.user._id;         // from auth middleware
    const businessId = req.user.businessId;

    const customer = await Customer.findOne({
      _id: req.body.customerId,
      businessId,
    });
    if (!customer) {
      return res.status(400).json({ message: "Invalid customer for this business" });
    }

    const newPayment = await Payment.create({
      ...req.body,
      userId,
      businessId,
    });

    req.audit = { action: "create", entity: "Payment", entityId: newPayment._id };
    return res.status(201).json({
      message: "Payment added successfully",
      data: newPayment,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to add payment",
      error: err.message,
    });
  }
};

export const getCustomerPayments = async (req, res) => {
  try {
    const { customerId } = req.params;

    const payments = await Payment.find({
      customerId,
      businessId: req.user.businessId,
    }).sort({ createdAt: -1 });

    return res.status(200).json(payments);
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch customer payments",
      error: err.message,
    });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { page, limit, q } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : null;
    const limitNum = limit ? Math.max(1, parseInt(limit, 10)) : null;

    const query = {
      businessId,
      ...(q
        ? {
            $or: [
              { method: { $regex: q, $options: "i" } },
              { transaction_id: { $regex: q, $options: "i" } },
              { slip_no: { $regex: q, $options: "i" } },
              { cheque_no: { $regex: q, $options: "i" } },
            ],
          }
        : {}),
    };

    const findQuery = Payment.find(query)
      .populate("customerId", "name phone_no")
      .populate("userId", "name")
      .sort({ createdAt: -1 });

    if (pageNum && limitNum) {
      const total = await Payment.countDocuments(query);
      const data = await findQuery
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
      return res.status(200).json({
        data,
        page: pageNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    const payments = await findQuery;
    res.status(200).json(payments);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch all payments",
      error: err.message,
    });
  }
};

export const deletePayment = async (req, res) => {
  try {
    const deleted = await Payment.findOneAndDelete({
      _id: req.params.id,
      businessId: req.user.businessId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Payment not found" });
    }
    req.audit = { action: "delete", entity: "Payment", entityId: deleted._id };
    res.status(200).json({ message: "Payment deleted" });
  } catch (err) {
    res.status(500).json({
      message: "Failed to delete payment",
      error: err.message,
    });
  }
};

export const updatePayment = async (req, res) => {
  try {
    const updated = await Payment.findOneAndUpdate(
      { _id: req.params.id, businessId: req.user.businessId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Payment not found" });
    }

    req.audit = { action: "update", entity: "Payment", entityId: updated._id };
    return res.status(200).json({
      message: "Payment updated successfully",
      data: updated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to update payment",
      error: err.message,
    });
  }
};
