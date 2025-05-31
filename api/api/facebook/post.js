const axios = require('axios');
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
      console.log("Firebase Admin SDK initialized in post function.");
    } else {
      throw new Error("FIREBASE_CREDENTIALS_JSON environment variable not set.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK in post function:", error);
  }
}
// const db = admin.firestore(); // لا نحتاج db هنا مباشرة، بل في دالة getPageAccessToken

// دالة مساعدة للحصول على رمز وصول الصفحة ومعرفها من Firestore
// (هذه الدالة مكررة هنا للتبسيط، في مشروع أكبر يمكن وضعها في ملف مشترك)
const getFirestorePath = (firebaseUserId, type = 'settings') => {
    const appId = process.env.FIRESTORE_APP_ID || 'default-app-id';
    if (type === 'facebookPageDetails') {
        return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}/settings/facebookPageDetails`;
    }
    return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}`; // مسار عام إذا احتجنا
};

async function getPageAccessToken(firebaseUserId) {
    const dbInstance = admin.firestore(); // احصل على instance لـ db هنا
    const pageDetailsRef = dbInstance.doc(getFirestorePath(firebaseUserId, 'facebookPageDetails'));
    const docSnap = await pageDetailsRef.get();
    if (docSnap.exists() && docSnap.data().fbPageAccessToken) {
        return {
            pageId: docSnap.data().fbPageId,
            accessToken: docSnap.data().fbPageAccessToken
        };
    }
    throw new Error('Page Access Token not found in Firestore. Please select a page in settings.');
}


module.exports = async (req, res) => {
  if (!admin.apps.length) {
    console.error("Firebase not initialized in post handler.");
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

  const { firebaseUserId, message } = req.body;
  if (!firebaseUserId || !message) {
    return res.status(400).json({ error: 'Firebase User ID and message are required.' });
  }

  try {
    const { pageId, accessToken } = await getPageAccessToken(firebaseUserId);
    const response = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      message: message,
      access_token: accessToken
    });
    res.status(200).json({ success: true, postId: response.data.id });
  } catch (error) {
    console.error('Error posting to Facebook:', error.response ? (error.response.data.error || error.response.data) : error.message);
    const errorMessage = error.response && error.response.data && error.response.data.error && error.response.data.error.message 
                       ? error.response.data.error.message 
                       : 'Failed to post to Facebook.';
    res.status(500).json({ error: errorMessage, details: error.response ? error.response.data.error : null });
  }
};
