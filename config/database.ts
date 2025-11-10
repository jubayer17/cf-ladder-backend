import mongoose from 'mongoose';

let isConnected = false;

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState === 1) {
        console.log('✅ Using existing MongoDB connection');
        return;
    }

    try {
        const mongoURI = process.env.MONGODB_URI;

        if (!mongoURI) {
            const errorMsg = '❌ MONGODB_URI environment variable is not defined!';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        console.log('🔄 Connecting to MongoDB...');

        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 10000, // 10 seconds for serverless
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
        });

        isConnected = true;
        console.log('✅ MongoDB connected successfully');

        // Handle connection events
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
            isConnected = false;
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
            isConnected = false;
        });

    } catch (error: any) {
        console.error('❌ MongoDB connection error:', error.message);
        isConnected = false;
        // Don't exit in serverless environment
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
        throw error;
    }
};

export default connectDB;
