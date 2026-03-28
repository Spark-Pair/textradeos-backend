import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import connectDB from "./config/db.js";

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import businessRoutes from "./routes/businessRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import articleRoutes from "./routes/articleRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";

import { protect, tenantGuard } from "./middlewares/authMiddleware.js";
import { auditLogger } from "./middlewares/auditMiddleware.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
}));
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

if (process.env.VERCEL === "true") {
  app.use(async (req, res, next) => {
    try {
      await connectDB();
      next();
    } catch (err) {
      console.error("Database connection failed on request:", err.message);
      res.status(500).json({ message: "Database connection failed" });
    }
  });
}

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running smoothly",
    timestamp: new Date().toISOString()
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/businesses", protect, businessRoutes);
app.use("/api/customers", protect, tenantGuard, customerRoutes);
app.use("/api/articles", protect, tenantGuard, articleRoutes);
app.use("/api/invoices", protect, tenantGuard, invoiceRoutes);
app.use("/api/payments", protect, tenantGuard, paymentRoutes);
app.use("/api/subscriptions", protect, tenantGuard, subscriptionRoutes);
app.use("/api/dashboard", protect, tenantGuard, dashboardRoutes);
app.use("/api/export-data", protect, tenantGuard, exportRoutes);
app.use("/api/backups", protect, tenantGuard, backupRoutes);

// Middlewares
app.use(auditLogger);
app.use(notFound);
app.use(errorHandler);

export default app;
