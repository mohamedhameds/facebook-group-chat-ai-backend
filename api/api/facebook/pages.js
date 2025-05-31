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
      console.log("Firebase Admin SDK initialized in pages function.");
    } else {
      throw new Error("FIREBASE_CREDENTIALS_JSON environment variable not set.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK in pages function:", error);
  }
}
const db = admin.firestore();

const getFirestorePath = (firebaseUserId, type = 'settings') => {
    const appId = process.env.FIRESTORE_APP_ID || 'default-app-id';
    if (type === 'facebookUserToken') {
         return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}/tokens/facebookUserAuth`;
    }
    return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}`;
};

module.exports = async (req, res) => {
  if (!admin.apps.length) {
    console.error("Firebase not initialized in pages handler.");
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
    return res.status(400).json({ error: 'Firebase User ID is required.' });
  }

  try {
    const userTokenRef = db.doc(getFirestorePath(firebaseUserId, 'facebookUserToken'));
    const tokenDoc = await userTokenRef.get();
    if (!tokenDoc.exists || !tokenDoc.data().accessToken) {
      return res.status(401).json({ error: 'User Facebook token not found. Please authenticate with Facebook first.' });
    }
    const userAccessToken = tokenDoc.data().accessToken;

    const pagesResponse = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
      params: {
        fields: 'id,name,access_token,category,tasks', // access_token هنا هو Page Access Token
        access_token: userAccessToken
      }
    });

    // تصفية الصفحات للاحتفاظ فقط بتلك التي يمكن للمستخدم إنشاء محتوى عليها
    const manageablePages = pagesResponse.data.data.filter(page => page.tasks && page.tasks.includes('CREATE_CONTENT'));

    // إرسال قائمة الصفحات (مع رموز وصولها) إلى الواجهة الأمامية
    res.status(200).json({ pages: manageablePages.map(p => ({ id: p.id, name: p.name, page_access_token: p.access_token })) });

  } catch (error) {
    console.error('Error fetching Facebook pages:', error.response ? error.response.data : error.message);
    let errorMessage = 'Failed to fetch Facebook pages.';
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorMessage = error.response.data.error.message;
    }
    res.status(500).json({ error: errorMessage });
  }
};
