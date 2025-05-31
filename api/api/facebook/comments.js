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
      console.log("Firebase Admin SDK initialized in comments function.");
    } else {
      throw new Error("FIREBASE_CREDENTIALS_JSON environment variable not set.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK in comments function:", error);
  }
}

// دالة مساعدة للحصول على رمز وصول الصفحة ومعرفها من Firestore
const getFirestorePath = (firebaseUserId, type = 'settings') => {
    const appId = process.env.FIRESTORE_APP_ID || 'default-app-id';
    if (type === 'facebookPageDetails') {
        return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}/settings/facebookPageDetails`;
    }
    return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}`;
};

async function getPageAccessToken(firebaseUserId) {
    const dbInstance = admin.firestore();
    const pageDetailsRef = dbInstance.doc(getFirestorePath(firebaseUserId, 'facebookPageDetails'));
    const docSnap = await pageDetailsRef.get();
    if (docSnap.exists() && docSnap.data().fbPageAccessToken) {
        return {
            pageId: docSnap.data().fbPageId, // قد لا نحتاجه هنا ولكن من الجيد إرجاعه
            accessToken: docSnap.data().fbPageAccessToken
        };
    }
    throw new Error('Page Access Token not found in Firestore. Please select a page in settings.');
}

module.exports = async (req, res) => {
  if (!admin.apps.length) {
    console.error("Firebase not initialized in comments handler.");
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

  const { firebaseUserId, postId } = req.query;
  if (!firebaseUserId || !postId) {
    return res.status(400).json({ error: 'Firebase User ID and Post ID are required.' });
  }

  try {
    const { accessToken } = await getPageAccessToken(firebaseUserId);
    const response = await axios.get(`https://graph.facebook.com/v19.0/${postId}/comments`, {
      params: {
        fields: 'id,message,from,created_time', // الحقول التي نطلبها للتعليقات
        access_token: accessToken
      }
    });
    res.status(200).json({ comments: response.data.data || [] }); // نرسل قائمة التعليقات (أو قائمة فارغة إذا لم يكن هناك تعليقات)
  } catch (error) {
    console.error('Error fetching Facebook comments:', error.response ? (error.response.data.error || error.response.data) : error.message);
    const errorMessage = error.response && error.response.data && error.response.data.error && error.response.data.error.message 
                       ? error.response.data.error.message 
                       : 'Failed to fetch Facebook comments.';
    res.status(500).json({ error: errorMessage, details: error.response ? error.response.data.error : null });
  }
};
