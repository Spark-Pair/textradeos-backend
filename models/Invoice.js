import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Article",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  selling_price_snapshot: {
    type: Number,
  },
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
    },

    invoiceDate: {
      type: Date,
      default: Date.now, // Agar date nahi aati toh aaj ki hogi
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false, // Isko false kar dein
    },

    isWalkIn: { // Ye field add karein track karne ke liye
      type: Boolean,
      default: false,
    },

    items: {
      type: [invoiceItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Invoice must include at least one item",
      },
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    grossAmount: Number,
    netAmount: Number,

    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// 🔥 Ensure invoiceNumber is unique per business
invoiceSchema.index({ invoiceNumber: 1, businessId: 1 }, { unique: true });
invoiceSchema.index({ businessId: 1, invoiceDate: -1 });

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
