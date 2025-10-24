// import mongoose from 'mongoose';

// const MONGODB_URI = process.env.MONGODB_URI || '';

// if (!MONGODB_URI) {
//   throw new Error('Please define the MONGODB_URI environment variable in your .env file');
// }

// // Create a global cache for the MongoDB connection
// let cached = global.mongoose as {
//   conn: typeof mongoose | null;
//   promise: Promise<typeof mongoose> | null;
// };

// // if (!cached) {
// //   cached = global.mongoose = { conn: null, promise: null };
// // }

// export async function connectToDatabase() {
//   // Return the existing connection if already established
//   if (cached.conn) {
//     console.log('Using existing database connection');
//     return cached.conn;
//   }

//   if (!cached.promise) {
//     console.log('Creating a new database connection');

//     const opts = {
//       bufferCommands: false, // Disable mongoose buffering
//     };

//     // Attempt to connect to MongoDB
//     cached.promise = mongoose.connect(MONGODB_URI, opts).then((connection) => {
//       return connection;
//     });
//   }

//   try {
//     cached.conn = await cached.promise;
//     console.log('Successfully connected to the database');
//   } catch (error) {
//     cached.promise = null;
//     console.error('Error connecting to the database:', error);
//     throw error;
//   }

//   return cached.conn;
// }

// declare global {
//   // Allow global `mongoose` object to avoid multiple connections in development
//   var mongoose: {
//     Types: any;
//     conn: typeof mongoose | null;
//     promise: Promise<typeof mongoose> | null;
//   };
// }