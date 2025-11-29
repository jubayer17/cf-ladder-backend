"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const MONGO_URI = process.env.MONGODB_URI;
const globalRef = globalThis;
if (!globalRef._mongooseCache)
  globalRef._mongooseCache = { conn: null, promise: null };
async function connectDB() {
  if (!MONGO_URI) {
    throw new Error("❌ MONGODB_URI not set");
  }
  if (globalRef._mongooseCache.conn) return;
  if (!globalRef._mongooseCache.promise) {
    mongoose_1.default.set("bufferCommands", false);
    mongoose_1.default.set("strictQuery", false);
    globalRef._mongooseCache.promise = mongoose_1.default
      .connect(MONGO_URI, {
        maxPoolSize: 5,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      })
      .then((conn) => {
        globalRef._mongooseCache.conn = conn;
        console.log("✅ MongoDB connected (mongoose)");
        return conn;
      })
      .catch((err) => {
        globalRef._mongooseCache.promise = null;
        console.error("❌ MongoDB connect failed:", err.message);
        throw err;
      });
  }
  await globalRef._mongooseCache.promise;
}
