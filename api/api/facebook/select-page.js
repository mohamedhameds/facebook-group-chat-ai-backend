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
      console.log("Firebase Admin SDK initialized in select-page function.");
    } else {
      throw new Error("FIREBASE_CREDENTIALS_JSON environment variable not set.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK in select-page function:", error);
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
    console.error("Firebase not initialized in select-page handler.");
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

  const { firebaseUserId, pageId, pageName, pageAccessToken } = req.body;
  if (!firebaseUserId || !pageId || !pageName || !pageAccessToken) {
    return res.status(400).json({ error: 'Firebase User ID, Page ID, Page Name, and Page Access Token are required.' });
  }

  try {
    const pageDetailsRef = db.doc(getFirestorePath(firebaseUserId, 'facebookPageDetails'));
    await pageDetailsRef.set({
      fbPageId: pageId,
      fbPageName: pageName,
      fbPageAccessToken: pageAccessToken, // هذا هو Page Access Token الذي سنستخدمه للعمليات على الصفحة
      selectedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // يمكن أيضًا تحديث مستند الإعدادات الرئيسي إذا كانت الواجهة الأمامية تعتمد عليه لبعض المعلومات
    // مثل fbPageId و fbPageName (ولكن ليس fbPageAccessToken لأسباب أمنية)
    const settingsRef = db.doc(getFirestorePath(firebaseUserId, 'settings'));
    await settingsRef.set({ 
      fbPageId: pageId, 
      fbPageName: pageName 
      // لا تقم بتخزين pageAccessToken هنا مرة أخرى إذا كان settingsRef عامًا أكثر
    }, { merge: true });

    res.status(200).json({ success: true, message: 'Page selected and access token stored successfully.' });
  } catch (error) {
    console.error('Error selecting Facebook page and storing token:', error.message);
    res.status(500).json({ error: 'Failed to select Facebook page and store token.' });
  }
};
