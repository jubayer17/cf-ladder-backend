import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) throw new Error('❌ MONGODB_URI not set');

type Cached = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

declare global {
    var _mongooseCache: Cached | undefined;
}

const globalRef: any = globalThis;
if (!globalRef._mongooseCache) globalRef._mongooseCache = { conn: null, promise: null };

export default async function connectDB(): Promise<void> {
    if (globalRef._mongooseCache.conn) return;
    if (!globalRef._mongooseCache.promise) {
        mongoose.set('bufferCommands', false);
        mongoose.set('strictQuery', false);

        globalRef._mongooseCache.promise = mongoose.connect(MONGO_URI!, {
            maxPoolSize: 5,
            minPoolSize: 1,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        }).then((conn) => {
            globalRef._mongooseCache.conn = conn;
            console.log('✅ MongoDB connected (mongoose)');
            return conn;
        }).catch(err => {
            globalRef._mongooseCache.promise = null;
            console.error('❌ MongoDB connect failed:', err.message);
            throw err;
        });
    }
    await globalRef._mongooseCache.promise;
}
