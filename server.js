import dotenv from "dotenv";
import connectDB from "./config/db.js";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const startServer = async () => {
  try {
    if (!isVercel) {
      await connectDB();
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    console.error("Check MONGO_URI, DNS/network access, and MongoDB Atlas IP access settings.");
    process.exit(1);
  }
};

startServer();
