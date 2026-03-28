import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    person_name: {
      type: String,
      required: [true, "Person name is required"],
      trim: true,
    },
    phone_no: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[0-9]{10,15}$/, "Invalid phone number format"], // optional custom validation
    },
    address: {
      type: String,
      trim: true,
    },
    isActive: { type: Boolean, default: true },

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

// 🔥 Compound Unique Index: name + businessId must be unique
customerSchema.index({ name: 1, businessId: 1 }, { unique: true });

// 🔥 Compound Unique Index: phone_no + businessId must be unique
customerSchema.index({ phone_no: 1, businessId: 1 }, { unique: true });
customerSchema.index({ businessId: 1 });

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
