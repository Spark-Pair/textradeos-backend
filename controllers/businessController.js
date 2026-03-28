import Business from "../models/Business.js";
import Session from "../models/Session.js";
import User from "../models/User.js";

// 🔹 Create Business + Linked User
export const createBusiness = async (req, res) => {
  try {
    const {
      name,
      owner,
      username,
      password,
      phone_no,
      registration_date,
      type,
      price,
    } = req.body;

    // Check if username or phone number already exists
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "Username already exists" });

    const existingBusiness = await Business.findOne({ phone_no });
    if (existingBusiness)
      return res.status(400).json({ message: "Phone number already exists" });

    // 1️⃣ Create User (with optional businessId = null for now)
    const user = await User.create({
      name: owner,
      username,
      password,
      businessId: null,
    });

    // 2️⃣ Create Business linked to the user
    const business = await Business.create({
      name,
      owner,
      phone_no,
      registration_date,
      type,
      price,
      userId: user._id,
    });

    // 3️⃣ Update user.businessId to link user to this business
    user.businessId = business._id;
    await user.save();

    req.audit = { action: "create", entity: "Business", entityId: business._id };
    res.status(201).json(business);
  } catch (error) {
    console.error("Error creating business:", error);
    res.status(400).json({ message: error.message });
  }
};

// 🔹 Get All Businesses
export const getBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find().populate(
      "userId",
      "name username businessId"
    );
    res.status(200).json(businesses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Get Single Business by ID
export const getBusinessById = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).populate(
      "userId",
      "name username businessId"
    );
    if (!business)
      return res.status(404).json({ message: "Business not found" });
    res.status(200).json(business);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Update Business (optionally update linked user)
export const updateBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business)
      return res.status(404).json({ message: "Business not found" });

    // Update linked user if username or password provided
    if (req.body.username || req.body.password) {
      const user = await User.findById(business.userId);
      if (req.body.username) user.username = req.body.username;
      if (req.body.password) user.password = req.body.password;
      await user.save();
    }

    Object.assign(business, req.body);
    await business.save();

    req.audit = { action: "update", entity: "Business", entityId: business._id };
    res.status(200).json(business);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 🔹 Delete Business + linked user
export const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business)
      return res.status(404).json({ message: "Business not found" });

    await User.findByIdAndDelete(business.userId); // remove linked user
    await business.remove();

    req.audit = { action: "delete", entity: "Business", entityId: business._id };
    res
      .status(200)
      .json({ message: "Business and linked user deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Toggle Active Status
export const toggleBusinessStatus = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business)
      return res.status(404).json({ message: "Business not found" });

    // Toggle active status
    const newStatus = !business.isActive;
    business.isActive = newStatus;
    await business.save();

    let latestSession = null;

    // Only close session if we set business inactive
    if (!newStatus) {
      latestSession = await Session.findOne({ userId: business.userId })
        .sort({ loginTime: -1 })
        .limit(1);

      if (latestSession && latestSession.isActive) {
        latestSession.logoutTime = new Date();
        latestSession.isActive = false;
        latestSession.duration = Math.floor(
          (latestSession.logoutTime - latestSession.loginTime) / (1000 * 60)
        );
        await latestSession.save();
      }
    }

    req.audit = { action: "toggle", entity: "Business", entityId: business._id };
    res.status(200).json({
      message: `Business is now ${newStatus ? "Active" : "Inactive"}`,
      business,
      sessionUpdated: latestSession ? true : false,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
