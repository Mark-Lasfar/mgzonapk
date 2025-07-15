import admin from 'firebase-admin';

if (typeof window === 'undefined' && !admin.apps.length) {
  try {
    console.log('projectId:', process.env.FIREBASE_ADMIN_PROJECT_ID);
    console.log('clientEmail:', process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
    console.log('privateKey starts with:', process.env.FIREBASE_ADMIN_PRIVATE_KEY?.slice(0, 20));

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      }),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw new Error('Failed to initialize Firebase Admin');
  }
}

export const adminAuth = admin.auth();
export const adminFirestore = admin.firestore();
export const adminMessaging = admin.messaging();
