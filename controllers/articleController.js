import Article from "../models/Article.js";
import ArticleStock from "../models/ArticleStock.js";
import Invoice from "../models/Invoice.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// 🔹 Helper: Get current stock of an article
export const getCurrentStock = async (articleId) => {
  const articleObjectId = new mongoose.Types.ObjectId(articleId);

  // 🔹 Sum of added stock
  const stockResult = await ArticleStock.aggregate([
    { $match: { articleId: articleObjectId } },
    { $group: { _id: "$articleId", totalAdded: { $sum: "$quantity" } } },
  ]);

  const totalAdded = stockResult[0]?.totalAdded || 0;

  // 🔹 Sum of sold stock from invoices
  const invoiceResult = await Invoice.aggregate([
    { $match: { "items.articleId": articleObjectId } },
    { $unwind: "$items" },
    { $match: { "items.articleId": articleObjectId } },
    { $group: { _id: "$items.articleId", totalSold: { $sum: "$items.quantity" } } },
  ]);

  const totalSold = invoiceResult[0]?.totalSold || 0;

  return totalAdded - totalSold;
};

// 🔹 Create Article with optional initial stock
export const createArticle = async (req, res) => {
  try {
    const userId = req.user._id; // <- logged-in user's business ID
    const businessId = req.user.businessId; // <- logged-in user's business ID

    const {
      article_no,
      season,
      size,
      category,
      type,
      initial_stock,
      purchase_price,
      selling_price,
    } = req.body;

    // Check if article_no already exists for the same business
    const existingArticle = await Article.findOne({ article_no, businessId });
    if (existingArticle) {
      return res
        .status(400)
        .json({ message: "Article number already exists for this business" });
    }

    // Create Article
    const article = await Article.create({
      article_no,
      season,
      size,
      category,
      type,
      purchase_price,
      selling_price,
      businessId,
      userId,
    });

    // Add initial stock if provided
    if (initial_stock && initial_stock > 0) {
      await ArticleStock.create({
        articleId: article._id,
        quantity: initial_stock,
        type: "in",
        businessId,
        userId,
        note: "Initial stock",
      });
    }

    // Return article with current stock
    const stock = await getCurrentStock(article._id);
    req.audit = { action: "create", entity: "Article", entityId: article._id };
    res.status(201).json({ ...article.toObject(), stock });
  } catch (error) {
    console.error("Error creating article:", error);
    res.status(400).json({ message: error.message });
  }
};

// 🔹 Get All Articles with current stock
export const getArticles = async (req, res) => {
  try {
    const businessId = req.user.businessId; // <- logged-in user's business ID
    // Fetch articles belonging to this business
    const { page, limit, q } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : null;
    const limitNum = limit ? Math.max(1, parseInt(limit, 10)) : null;

    const query = {
      businessId,
      ...(q
        ? {
            $or: [
              { article_no: { $regex: q, $options: "i" } },
              { category: { $regex: q, $options: "i" } },
              { type: { $regex: q, $options: "i" } },
            ],
          }
        : {}),
    };

    const findQuery = Article.find(query);

    if (pageNum && limitNum) {
      const total = await Article.countDocuments(query);
      const articles = await findQuery
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      const articlesWithStock = await Promise.all(
        articles.map(async (article) => {
          const stock = await getCurrentStock(article._id);
          return { ...article.toObject(), stock };
        })
      );

      return res.status(200).json({
        data: articlesWithStock,
        page: pageNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    const articles = await findQuery;

    // Add current stock for each article
    const articlesWithStock = await Promise.all(
      articles.map(async (article) => {
        const stock = await getCurrentStock(article._id);
        return { ...article.toObject(), stock };
      })
    );

    res.status(200).json(articlesWithStock);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Get Single Article by ID with stock
export const getArticleById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid article ID" });
    }

    const article = await Article.findOne({
      _id: req.params.id,
      businessId: req.user.businessId,
    }).populate("userId", "username email");
    if (!article) return res.status(404).json({ message: "Article not found" });

    const stock = await getCurrentStock(article._id);
    req.audit = { action: "update", entity: "Article", entityId: article._id };
    res.status(200).json({ ...article.toObject(), stock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Update Article and optionally add stock
export const updateArticle = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid article ID" });
    }

    const article = await Article.findOne({
      _id: req.params.id,
      businessId: req.user.businessId,
    });
    if (!article) return res.status(404).json({ message: "Article not found" });

    // Update article fields
    const fieldsToUpdate = [
      "article_no",
      "season",
      "size",
      "category",
      "type",
      "purchase_price",
      "selling_price",
    ];
    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        article[field] = req.body[field];
      }
    });

    await article.save();

    // Add stock if provided
    if (req.body.stockChange && req.body.stockChange !== 0) {
      await ArticleStock.create({
        articleId: article._id,
        quantity: req.body.stockChange, // positive for addition, negative for removal
        type: req.body.stockChange > 0 ? "in" : "out",
        businessId: article.businessId,
        userId: req.user._id,
        note: req.body.stockNote || "Stock update",
      });
    }

    const stock = await getCurrentStock(article._id);
    res.status(200).json({ ...article.toObject(), stock });
  } catch (error) {
    console.error("Error updating article:", error);
    res.status(400).json({ message: error.message });
  }
};

export const addStock = async (req, res) => {
  try {
    const userId = req.user._id; // <- logged-in user's business ID
    const businessId = req.user.businessId; // <- logged-in user's business ID

    const {
      articleId,
      quantity,
    } = req.body;

    const article = await Article.findOne({ _id: articleId, businessId });
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // add stock
    await ArticleStock.create({
      articleId: articleId,
      quantity: quantity,
      type: "in",
      businessId,
      userId,
      note: "add stock",
    });

    req.audit = { action: "stock_in", entity: "Article", entityId: articleId };
    res.status(201).json({ message: "Stock added successsfully." });
  } catch (error) {
    console.error("Error adding stock:", error);
    res.status(400).json({ message: error.message });
  }
};
