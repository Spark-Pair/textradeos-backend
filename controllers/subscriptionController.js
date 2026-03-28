import Subscription from "../models/Subscription.js";
import Business from "../models/Business.js";

// 🔹 Create Subscription for a business
export const createSubscription = async (req, res) => {
  try {
    const { businessId, type, price, paymentStatus } = req.body;

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    const startDate = new Date();
    const endDate =
      type === "monthly"
        ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subscription = await Subscription.create({
      businessId,
      type,
      price,
      startDate,
      endDate,
      paymentStatus: paymentStatus || "paid",
      paymentDate: paymentStatus === "paid" ? new Date() : null,
    });

    // Update Business active status
    business.isActive = subscription.paymentStatus === "paid";
    await business.save();

    req.audit = { action: "create", entity: "Subscription", entityId: subscription._id };
    res.status(201).json(subscription);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 🔹 Get All Subscriptions
export const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate("businessId", "name owner phone_no isActive");
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Get Single Subscription
export const getSubscriptionById = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate("businessId", "name owner phone_no isActive");
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });
    res.status(200).json(subscription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Update Subscription (payment, dates, type)
export const updateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });

    Object.assign(subscription, req.body);
    if (req.body.paymentStatus === "paid" && !subscription.paymentDate) {
      subscription.paymentDate = new Date();
    }
    await subscription.save();

    // Update Business active status
    const business = await Business.findById(subscription.businessId);
    if (business) {
      business.isActive = subscription.paymentStatus === "paid";
      await business.save();
    }

    req.audit = { action: "update", entity: "Subscription", entityId: subscription._id };
    res.status(200).json(subscription);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 🔹 Delete Subscription
export const deleteSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });

    await subscription.remove();

    req.audit = { action: "delete", entity: "Subscription", entityId: subscription._id };
    res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleSubscriptionStatus = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });

    const nextStatus = subscription.paymentStatus === "paid" ? "unpaid" : "paid";
    subscription.paymentStatus = nextStatus;
    subscription.paymentDate = nextStatus === "paid" ? new Date() : null;
    await subscription.save();

    const business = await Business.findById(subscription.businessId);
    if (business) {
      business.isActive = nextStatus === "paid";
      await business.save();
    }

    req.audit = { action: "toggle", entity: "Subscription", entityId: subscription._id };
    res.status(200).json(subscription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMySubscriptionStatus = async (req, res) => {
  try {
    // Check if user exists (middleware check)
    if (!req?.user?.businessId) {
      return res.status(401).json({ message: "Unauthorized: No Business ID found" });
    }

    const subscription = await Subscription.findOne({ 
      businessId: req.user.businessId 
    })
    .populate("businessId", "name")
    .sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({ message: "No subscription found" });
    }

    // Logic for dates
    const today = new Date();
    const endDate = new Date(subscription.endDate);
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    res.json({
      ...subscription.toObject(),
      daysRemaining: diffDays > 0 ? diffDays : 0,
      isExpired: diffDays <= 0
    });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ message: error.message });
  }
};
