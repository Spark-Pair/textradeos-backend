import Business from "../models/Business.js";
import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";
import Session from "../models/Session.js";
import Subscription from "../models/Subscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import User from "../models/User.js";

const allowedRoles = ["developer", "admin", "manager", "staff", "user"];
const allowedSubscriptionTypes = ["monthly", "yearly"];
const allowedPaymentStatuses = ["paid", "unpaid", "pending"];

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days));
  return next;
};

const getDaysRemaining = (endDate) => {
  if (!endDate) return 0;
  return Math.max(0, Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24)));
};

export const getDeveloperConsole = async (req, res) => {
  try {
    const today = startOfToday();

    const [
      businesses,
      subscriptions,
      users,
      payments,
      customersCount,
      activeSessions,
      plans,
    ] = await Promise.all([
      Business.find().populate("userId", "name username role isActive").lean(),
      Subscription.find().populate("businessId", "name owner phone_no isActive").sort({ endDate: -1 }).lean(),
      User.find().select("-password").populate("businessId", "name isActive").sort({ createdAt: -1 }).lean(),
      Payment.find()
        .populate("businessId", "name")
        .populate("customerId", "name phone_no")
        .populate("userId", "name username")
        .sort({ createdAt: -1 })
        .limit(150)
        .lean(),
      Customer.countDocuments(),
      Session.find({ isActive: true }).populate("userId", "name username role businessId").lean(),
      SubscriptionPlan.find().sort({ isActive: -1, price: 1 }).lean(),
    ]);

    const latestByBusiness = new Map();
    for (const sub of subscriptions) {
      const businessId = sub.businessId?._id?.toString() || sub.businessId?.toString();
      if (businessId && !latestByBusiness.has(businessId)) {
        latestByBusiness.set(businessId, sub);
      }
    }

    const enrichedBusinesses = businesses.map((business) => {
      const latestSubscription = latestByBusiness.get(business._id.toString()) || null;
      return {
        ...business,
        latestSubscription,
        subscriptionStatus: latestSubscription?.paymentStatus || "none",
        daysRemaining: latestSubscription ? getDaysRemaining(latestSubscription.endDate) : 0,
      };
    });

    const totalRevenue = subscriptions.reduce(
      (sum, sub) => sum + (sub.paymentStatus === "paid" ? Number(sub.price || 0) : 0),
      0
    );

    const expiringSoon = subscriptions.filter((sub) => {
      const days = getDaysRemaining(sub.endDate);
      return days > 0 && days <= 7;
    }).length;

    res.json({
      stats: {
        totalBusinesses: businesses.length,
        activeBusinesses: businesses.filter((business) => business.isActive).length,
        inactiveBusinesses: businesses.filter((business) => !business.isActive).length,
        totalUsers: users.filter((user) => user.role !== "developer").length,
        activeUsers: users.filter((user) => user.isActive).length,
        customersCount,
        activeSessions: activeSessions.length,
        totalRevenue,
        paidSubscriptions: subscriptions.filter((sub) => sub.paymentStatus === "paid").length,
        pendingSubscriptions: subscriptions.filter((sub) => sub.paymentStatus === "pending").length,
        expiredSubscriptions: subscriptions.filter((sub) => new Date(sub.endDate) < today).length,
        expiringSoon,
      },
      businesses: enrichedBusinesses,
      subscriptions,
      users,
      payments,
      plans,
      roles: allowedRoles.map((role) => ({
        role,
        permissions: getRolePermissions(role),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDeveloperUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("businessId", "name isActive")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDeveloperUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, username, password, role, businessId, isActive } = req.body;

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (username && username !== user.username) {
      const exists = await User.findOne({ username, _id: { $ne: user._id } });
      if (exists) return res.status(400).json({ message: "Username already exists" });
      user.username = username;
    }

    if (name !== undefined) user.name = name;
    if (password) user.password = password;
    if (role) user.role = role;
    if (businessId !== undefined) user.businessId = businessId || null;
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    await user.save();

    if (!user.isActive) {
      await Session.updateMany(
        { userId: user._id, isActive: true },
        { $set: { isActive: false, logoutTime: new Date() } }
      );
    }

    req.audit = { action: "update", entity: "User", entityId: user._id };
    const updated = await User.findById(user._id).select("-password").populate("businessId", "name isActive");
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getDeveloperPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("businessId", "name")
      .populate("customerId", "name phone_no")
      .populate("userId", "name username")
      .sort({ createdAt: -1 })
      .limit(300);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const extendDeveloperSubscription = async (req, res) => {
  try {
    const { days, type, price, paymentStatus = "paid" } = req.body;
    const extensionDays = Number(days);

    if (!Number.isFinite(extensionDays) || extensionDays < 1) {
      return res.status(400).json({ message: "days must be a positive number" });
    }

    if (type && !allowedSubscriptionTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid subscription type" });
    }

    if (!allowedPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid payment status" });
    }

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });

    const baseDate = new Date(subscription.endDate) > new Date() ? subscription.endDate : new Date();
    subscription.endDate = addDays(baseDate, extensionDays);
    subscription.paymentStatus = paymentStatus;
    subscription.paymentDate = paymentStatus === "paid" ? new Date() : subscription.paymentDate;
    if (type) subscription.type = type;
    if (price !== undefined) subscription.price = Number(price);

    await subscription.save();

    const business = await Business.findById(subscription.businessId);
    if (business) {
      business.isActive = paymentStatus === "paid";
      await business.save();
    }

    req.audit = { action: "extend", entity: "Subscription", entityId: subscription._id };
    const updated = await Subscription.findById(subscription._id).populate("businessId", "name owner phone_no isActive");
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ isActive: -1, price: 1 });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createPlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.create(normalizePlanPayload(req.body));
    req.audit = { action: "create", entity: "SubscriptionPlan", entityId: plan._id };
    res.status(201).json(plan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      normalizePlanPayload(req.body, true),
      { new: true, runValidators: true }
    );
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    req.audit = { action: "update", entity: "SubscriptionPlan", entityId: plan._id };
    res.json(plan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    req.audit = { action: "delete", entity: "SubscriptionPlan", entityId: plan._id };
    res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const normalizePlanPayload = (body, partial = false) => {
  const payload = {};
  const fields = ["name", "type", "durationDays", "price", "description", "features", "isActive"];

  for (const field of fields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }

  if (!partial || payload.type !== undefined) {
    if (!allowedSubscriptionTypes.includes(payload.type)) {
      throw new Error("Invalid plan type");
    }
  }

  if (payload.durationDays !== undefined) payload.durationDays = Number(payload.durationDays);
  if (payload.price !== undefined) payload.price = Number(payload.price);
  if (typeof payload.features === "string") {
    payload.features = payload.features.split("\n").map((item) => item.trim()).filter(Boolean);
  }

  return payload;
};

const getRolePermissions = (role) => {
  const permissions = {
    developer: ["All businesses", "Plans", "Subscriptions", "Users", "Payments", "Backups", "System overview"],
    admin: ["Business setup", "Customers", "Articles", "Invoices", "Payments", "Reports"],
    manager: ["Customers", "Articles", "Invoices", "Payments", "Reports"],
    staff: ["Customers", "Articles", "Invoices"],
    user: ["Business workspace"],
  };

  return permissions[role] || [];
};
