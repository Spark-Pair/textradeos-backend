import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
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
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    method: {
      type: String,
      enum: ["cash", "online", "slip", "cheque"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    remarks: {
      type: String,
      default: "-",
    },

    date: {
      type: Date,
      required: true,
    },

    // Online fields
    bank: { type: String },
    transaction_id: { type: String },

    // Slip fields
    slip_date: { type: Date },
    clear_date: { type: Date },
    slip_no: { type: String },

    // Cheque fields
    cheque_no: { type: String },
    cheque_date: { type: Date },
    cheque_bank: { type: String },
  },
  { timestamps: true }
);

paymentSchema.index({ businessId: 1, createdAt: -1 });
paymentSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.model("Payment", paymentSchema);
