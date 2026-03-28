import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";
import Business from "../models/Business.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

// 1️⃣ Stats Controller
export const stats = async (req, res) => {
  try {
    const { role, businessId: rawBusinessId } = req.user;

    // Dates Calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // =====================================================
    //                🟢 DEVELOPER DASHBOARD
    // =====================================================
    if (role === "developer") {
      const [
        totalBusinesses,
        activeBusinesses,
        expiredSubscriptions,
        totalUsers,
        totalRevenueAgg
      ] = await Promise.all([
        Business.countDocuments(),
        Business.countDocuments({ isActive: true }),
        Subscription.countDocuments({ endDate: { $lt: new Date() } }),
        User.countDocuments({ role: { $ne: "developer" } }),
        Subscription.aggregate([
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$price" } } }
        ])
      ]);

      return res.json({
        role: "developer",
        totalBusinesses,
        activeBusinesses,
        expiredSubscriptions,
        totalUsers,
        totalRevenue: totalRevenueAgg[0]?.total || 0,
      });
    }

    // =====================================================
    //                🟡 NORMAL USER / ADMIN DASHBOARD
    // =====================================================
    
    // String ID ko MongoDB ObjectId mein convert karna zaroori hai aggregation ke liye
    const bId = new mongoose.Types.ObjectId(rawBusinessId?._id || rawBusinessId);

    const [todaySales, monthlySales, todayPayments, monthlyPayments] = await Promise.all([
      // Today Sales
      Invoice.aggregate([
        { $match: { businessId: bId, invoiceDate: { $gte: today } } },
        { $group: { _id: null, total: { $sum: "$netAmount" } } }
      ]),
      // Monthly Sales
      Invoice.aggregate([
        { $match: { businessId: bId, invoiceDate: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$netAmount" } } }
      ]),
      // Today Payments
      Payment.aggregate([
        { $match: { businessId: bId, createdAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      // Monthly Payments
      Payment.aggregate([
        { $match: { businessId: bId, createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    return res.json({
      role: role,
      todaySales: todaySales[0]?.total || 0,
      monthlySales: monthlySales[0]?.total || 0,
      todayPayments: todayPayments[0]?.total || 0,
      monthlyPayments: monthlyPayments[0]?.total || 0,
    });

  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ message: "Server error while fetching stats" });
  }
};

// 2️⃣ Sales Chart Data Controller
export const sales = async (req, res) => {
  try {
    const { role, businessId: rawBusinessId } = req.user;
    const { start, end } = req.query;

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    // Developer Chart: New Businesses
    if (role === "developer") {
      const result = await Business.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            total: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } }
      ]);
      return res.json(result.map(r => ({ date: r._id, amount: r.total })));
    }

    // User/Admin Chart: Daily Sales
    const bId = new mongoose.Types.ObjectId(rawBusinessId?._id || rawBusinessId);
    const result = await Invoice.aggregate([
      {
        $match: {
          businessId: bId,
          invoiceDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } },
          totalAmount: { $sum: "$netAmount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json(result.map(r => ({
      date: r._id,
      amount: r.totalAmount
    })));

  } catch (err) {
    console.error("Sales Chart Error:", err);
    res.status(500).json({ message: "Server error while fetching chart data" });
  }
};

// 3️⃣ Active Users (Developer Only)
export const getLoggedInUsers = async (req, res) => {
  try {
    const sessions = await Session.find({ isActive: true }).populate({
      path: "userId",
      select: "name businessId role",
      populate: { path: "businessId", select: "name" }
    });

    const activeUsers = sessions
      .filter(s => s.userId && s.userId.role !== "developer")
      .map(s => ({
        userId: s.userId._id,
        name: s.userId.name,
        businessName: s.userId.businessId?.name || "N/A",
        loginTime: s.loginTime,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent
      }));

    res.json(activeUsers);
  } catch (err) {
    res.status(500).json({ message: "Error fetching active users" });
  }
};
