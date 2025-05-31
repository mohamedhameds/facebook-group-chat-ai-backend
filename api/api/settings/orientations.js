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
      console.log("Firebase Admin SDK initialized in settings/orientations function.");
    } else {
      throw new Error("FIREBASE_CREDENTIALS_JSON environment variable not set.");
    }
  } catch (error)
  {
    console.error("Error initializing Firebase Admin SDK in settings/orientations function:", error);
  }
}
const db = admin.firestore();

const getFirestorePath = (firebaseUserId, type = 'settings') => {
    const appId = process.env.FIRESTORE_APP_ID || 'default-app-id';
    if (type === 'settings') {
        return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}/settings/facebookAiAssistant`;
    }
    return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}`;
};

module.exports = async (req, res) => {
  if (!admin.apps.length) {
    console.error("Firebase not initialized in settings/orientations handler.");
    return res.status(500).json({ error: "Firebase initialization failed." });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { firebaseUserId, aiOrientations } = req.body;
  if (!firebaseUserId || aiOrientations === undefined) {
    return res.status(400).json({ error: "Firebase User ID and AI Orientations are required." });
  }

  try {
    const settingsRef = db.doc(getFirestorePath(firebaseUserId, 'settings'));
    // نحفظ فقط توجهات الذكاء الاصطناعي هنا، مع دمجها مع أي إعدادات أخرى موجودة
    await settingsRef.set({ aiOrientations }, { merge: true }); 
    res.status(200).json({ success: true, message: "AI Orientations saved." });
  } catch (error) {
    console.error("Error saving AI Orientations:", error.message);
    res.status(500).json({ error: "Failed to save AI Orientations." });
  }
};
