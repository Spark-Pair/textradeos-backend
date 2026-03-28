import mongoose from "mongoose";

const articleSchema = new mongoose.Schema(
  {
    article_no: { type: String, required: true, trim: true },
    season: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    purchase_price: { type: Number, required: true, min: 1 },
    selling_price: { type: Number, required: true, min: 1 },

    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

articleSchema.index({ businessId: 1, article_no: 1 });

const Article = mongoose.model("Article", articleSchema);
export default Article;
