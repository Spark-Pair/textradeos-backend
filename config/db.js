import mongoose from "mongoose";
import dns from "node:dns";

let isConnected = false;
let dnsConfigured = false;

const configureDns = () => {
  if (dnsConfigured || !process.env.DNS_SERVERS) return;

  const servers = process.env.DNS_SERVERS.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length > 0) {
    dns.setServers(servers);
    dnsConfigured = true;
  }
};

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set. Add it to .env or your hosting environment.");
  }

  configureDns();

  if (isConnected && mongoose.connection.readyState === 1) return;

  try {
    await mongoose.connect(process.env.MONGO_URI);

    isConnected = true;
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

export default connectDB;
