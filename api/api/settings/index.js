const admin = require('firebase-admin');
require('dotenv').config();

// --- تهيئة Firebase Admin SDK ---
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_CREDENTIALS_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin SDK initialized in settings/index function.");
    } else {
      throw new Error("FIREBASE_CREDENTIALS_JSON environment variable not set.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK in settings/index function:", error);
  }
}
const db = admin.firestore();

const getFirestorePath = (firebaseUserId, type = 'settings') => {
    const appId = process.env.FIRESTORE_APP_ID || 'default-app-id';
    if (type === 'settings') {
        return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}/settings/facebookAiAssistant`;
    } else if (type === 'facebookPageDetails') {
        return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}/settings/facebookPageDetails`;
    }
    return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}`;
};

module.exports = async (req, res) => {
  if (!admin.apps.length) {
    console.error("Firebase not initialized in settings/index handler.");
    return res.status(500).json({ error: "Firebase initialization failed." });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { firebaseUserId } = req.query;
  if (!firebaseUserId) {
    return res.status(400).json({ error: 'Firebase User ID required.' });
  }

  try {
    const settingsRef = db.doc(getFirestorePath(firebaseUserId, 'settings'));
    const pageDetailsRef = db.doc(getFirestorePath(firebaseUserId, 'facebookPageDetails'));

    const settingsSnap = await settingsRef.get();
    const pageDetailsSnap = await pageDetailsRef.get();

    let settingsData = {};
    if (settingsSnap.exists()) {
        settingsData = { ...settingsSnap.data() };
    }
    if (pageDetailsSnap.exists()) {
        // ندمج بيانات تفاصيل الصفحة، مع الحرص على عدم إرسال pageAccessToken للواجهة الأمامية
        const { fbPageAccessToken, ...pageDetails } = pageDetailsSnap.data();
        settingsData = { ...settingsData, ...pageDetails };
    }

    res.status(200).json(settingsData);
  } catch (error) {
    console.error("Error fetching settings from backend:", error.message);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
};
