import BackupSnapshot from "../models/BackupSnapshot.js";
import Business from "../models/Business.js";
import Customer from "../models/Customer.js";
import Article from "../models/Article.js";
import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";

const getBizId = (req) =>
  req.user.role === "developer" ? req.body.businessId || req.query.businessId : req.user.businessId;

export const createBackup = async (req, res) => {
  try {
    const businessId = getBizId(req);
    if (!businessId) return res.status(400).json({ message: "Business ID required" });

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: "Business not found" });

    const [customers, articles, invoices, payments, subscriptions, users] = await Promise.all([
      Customer.find({ businessId }).lean(),
      Article.find({ businessId }).lean(),
      Invoice.find({ businessId }).lean(),
      Payment.find({ businessId }).lean(),
      Subscription.find({ businessId }).lean(),
      User.find({ businessId }).lean(),
    ]);

    const data = {
      business,
      customers,
      articles,
      invoices,
      payments,
      subscriptions,
      users,
    };

    const payload = JSON.stringify(data);
    const snapshot = await BackupSnapshot.create({
      businessId,
      createdBy: req.user._id,
      note: req.body.note || "",
      data,
      size: Buffer.byteLength(payload, "utf8"),
    });

    req.audit = { action: "backup_create", entity: "BackupSnapshot", entityId: snapshot._id };
    res.status(201).json(snapshot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listBackups = async (req, res) => {
  try {
    const businessId = getBizId(req);
    if (!businessId) return res.status(400).json({ message: "Business ID required" });

    const backups = await BackupSnapshot.find({ businessId })
      .select("_id businessId createdBy createdAt size note")
      .sort({ createdAt: -1 });
    res.json(backups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getBackup = async (req, res) => {
  try {
    const businessId = getBizId(req);
    const backup = await BackupSnapshot.findOne({ _id: req.params.id, businessId });
    if (!backup) return res.status(404).json({ message: "Backup not found" });
    res.json(backup);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const restoreBackup = async (req, res) => {
  try {
    const businessId = getBizId(req);
    const backup = await BackupSnapshot.findOne({ _id: req.params.id, businessId });
    if (!backup) return res.status(404).json({ message: "Backup not found" });

    const { data } = backup;
    if (!data) return res.status(400).json({ message: "Backup data missing" });

    // Wipe current business data (business doc kept)
    await Promise.all([
      Customer.deleteMany({ businessId }),
      Article.deleteMany({ businessId }),
      Invoice.deleteMany({ businessId }),
      Payment.deleteMany({ businessId }),
      Subscription.deleteMany({ businessId }),
      User.deleteMany({ businessId, role: { $ne: "developer" } }),
    ]);

    // Restore collections
    const restoreOps = [];
    if (data.customers?.length) restoreOps.push(Customer.insertMany(data.customers));
    if (data.articles?.length) restoreOps.push(Article.insertMany(data.articles));
    if (data.invoices?.length) restoreOps.push(Invoice.insertMany(data.invoices));
    if (data.payments?.length) restoreOps.push(Payment.insertMany(data.payments));
    if (data.subscriptions?.length) restoreOps.push(Subscription.insertMany(data.subscriptions));
    if (data.users?.length) restoreOps.push(User.insertMany(data.users));
    await Promise.all(restoreOps);

    req.audit = { action: "backup_restore", entity: "BackupSnapshot", entityId: backup._id };
    res.json({ message: "Backup restored successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
