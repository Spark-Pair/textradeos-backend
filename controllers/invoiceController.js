import Invoice from "../models/Invoice.js";
import Article from "../models/Article.js";
import Customer from "../models/Customer.js";
import { getCurrentStock } from "./articleController.js";

const generateInvoiceNumber = async (businessId) => {
  const year = new Date().getFullYear().toString().slice(-2); // "25"

  // Find latest invoice for this business for this year
  const lastInvoice = await Invoice.findOne({
    businessId,
    invoiceNumber: { $regex: `^INV-${year}` },
  }).sort({ createdAt: -1 });

  let nextSerial = 1;

  if (lastInvoice) {
    const lastSerial = parseInt(lastInvoice.invoiceNumber.slice(6)); // "INV-25" => start at index 6
    nextSerial = lastSerial + 1;
  }

  const padded = String(nextSerial).padStart(3, "0");

  return `INV-${year}${padded}`;
};

export const createInvoice = async (req, res) => {
  try {
    const userId = req.user._id;
    const businessId = req.user.businessId;

    // 1. req.body se 'date' ko nikaalein (Jo humne frontend se payload mein bheji hai)
    const { customerId, items, discount = 0, grossAmount, netAmount, date } = req.body;

    const isWalkIn = !customerId;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "Invoice must contain items" });

    if (customerId) {
      const customer = await Customer.findOne({ _id: customerId, businessId });
      if (!customer) {
        return res.status(400).json({ message: "Invalid customer for this business" });
      }
    }

    const stockCache = new Map();
    const itemsWithSnapshot = [];
    for (const item of items) {
      const article = await Article.findOne({ _id: item.articleId, businessId });
      if (!article) return res.status(400).json({ message: "Invalid article ID" });

      let available = stockCache.get(String(article._id));
      if (available === undefined) {
        available = await getCurrentStock(article._id);
      }

      if (item.quantity > available) {
        return res.status(400).json({
          message: `Not enough stock for ${article.article_no}. Available: ${available}`,
        });
      }

      stockCache.set(String(article._id), available - item.quantity);

      itemsWithSnapshot.push({
        articleId: item.articleId,
        quantity: item.quantity,
        selling_price_snapshot: article.selling_price,
      });
    }

    const invoiceNumber = await generateInvoiceNumber(businessId);

    // 2. Invoice create karte waqt 'invoiceDate' field set karein
    const invoice = await Invoice.create({
      invoiceNumber,
      invoiceDate: date || new Date(), // User ki select ki hui date
      customerId: customerId || null,
      isWalkIn, 
      items: itemsWithSnapshot,
      discount,
      grossAmount,
      netAmount,
      userId,
      businessId,
    });

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate({ path: "customerId", select: "_id name phone_no" })
      .populate({ path: "items.articleId", select: "_id article_no" });

    req.audit = { action: "create", entity: "Invoice", entityId: invoice._id };
    res.status(201).json(populatedInvoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const { page, limit, q } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : null;
    const limitNum = limit ? Math.max(1, parseInt(limit, 10)) : null;

    const query = {
      businessId,
      ...(q ? { invoiceNumber: { $regex: q, $options: "i" } } : {}),
    };

    const findQuery = Invoice.find(query)
      .populate("customerId", "name phone_no")
      .populate("items.articleId", "article_no")
      .sort({ createdAt: -1 });

    if (pageNum && limitNum) {
      const total = await Invoice.countDocuments(query);
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

    const invoices = await findQuery;
    res.status(200).json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, businessId: req.user.businessId })
      .populate("customerId", "name person_name phone_no address")
      .populate("items.articleId", "article_no selling_price");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.status(200).json(invoice);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const invoice = await Invoice.findOne({ _id: req.params.id, businessId });
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const { customerId, items, discount, date, invoiceDate } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invoice must contain items" });
    }

    if (customerId) {
      const customer = await Customer.findOne({ _id: customerId, businessId });
      if (!customer) {
        return res.status(400).json({ message: "Invalid customer for this business" });
      }
    }

    const previousQtyByArticle = new Map();
    for (const item of invoice.items) {
      const key = String(item.articleId);
      previousQtyByArticle.set(
        key,
        (previousQtyByArticle.get(key) || 0) + item.quantity
      );
    }

    const itemsWithSnapshot = [];
    for (const item of items) {
      const article = await Article.findOne({ _id: item.articleId, businessId });
      if (!article) return res.status(400).json({ message: "Invalid article ID" });

      const oldQty = previousQtyByArticle.get(String(article._id)) || 0;
      const available = (await getCurrentStock(article._id)) + oldQty;

      if (item.quantity > available) {
        return res.status(400).json({
          message: `Not enough stock for ${article.article_no}. Available: ${available}`,
        });
      }

      itemsWithSnapshot.push({
        articleId: item.articleId,
        quantity: item.quantity,
        selling_price_snapshot: article.selling_price,
      });
    }

    const appliedDiscount =
      discount === undefined || discount === null ? invoice.discount || 0 : discount;

    const grossAmount = itemsWithSnapshot.reduce(
      (sum, i) => sum + i.selling_price_snapshot * i.quantity,
      0
    );
    const netAmount = grossAmount * (1 - appliedDiscount / 100);

    invoice.customerId = customerId || null;
    invoice.isWalkIn = !customerId;
    invoice.items = itemsWithSnapshot;
    invoice.discount = appliedDiscount;
    invoice.grossAmount = grossAmount;
    invoice.netAmount = netAmount;
    invoice.invoiceDate = invoiceDate || date || invoice.invoiceDate;

    await invoice.save();

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate({ path: "customerId", select: "_id name phone_no" })
      .populate({ path: "items.articleId", select: "_id article_no" });

    req.audit = { action: "update", entity: "Invoice", entityId: invoice._id };
    res.status(200).json(populatedInvoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
