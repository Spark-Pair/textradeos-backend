import express from "express";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Session from "../models/Session.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// GET /auth/status
router.get("/status", protect, async (req, res) => {
  try {
    // 🔐 1️⃣ CHECK ACTIVE SESSION
    if (!req.sessionId) {
      return res.status(401).json({
        message: "Session missing",
        sessionActive: false
      });
    }

    const session = await Session.findOne({
      _id: req.sessionId,
      userId: req.user.id,
      isActive: true
    });

    if (!session) {
      return res.status(401).json({
        message: "Session expired or invalid",
        sessionActive: false
      });
    }

    // 👤 2️⃣ FETCH USER
    const user = await User.findById(req.user.id).populate("businessId");
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // 📦 3️⃣ SUBSCRIPTION / READ-ONLY CHECK
    let isReadOnly = false;

    if (user.role !== "developer") {
      const subscription = await Subscription.findOne({
        businessId: user.businessId?._id
      }).sort({ endDate: -1 });

      const now = new Date();

      if (!subscription || now > new Date(subscription.endDate)) {
        isReadOnly = true;
      }
    }

    // 🧠 4️⃣ FINAL RESPONSE
    const userData = user.toObject();
    userData.isReadOnly = isReadOnly;
    userData.sessionActive = true;

    res.json({
      user: userData
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
