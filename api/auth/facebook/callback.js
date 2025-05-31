const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

// --- تهيئة Firebase Admin SDK ---
// هذا الكود يتأكد من أن Firebase يتم تهيئته مرة واحدة فقط
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_CREDENTIALS_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin SDK initialized in callback function.");
    } else {
      // هذا الخطأ سيظهر في سجلات Vercel إذا لم يتم ضبط المتغير البيئي
      throw new Error("FIREBASE_CREDENTIALS_JSON environment variable is not set.");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK in callback function:", error);
    // في حالة فشل التهيئة، قد ترغب في منع الدالة من المتابعة
    // أو التعامل مع الخطأ بطريقة تمنع تعطل التطبيق بالكامل
  }
}
const db = admin.firestore(); // يجب أن يتم هذا بعد التأكد من التهيئة الناجحة

// دالة مساعدة للحصول على مسار Firestore
const getFirestorePath = (firebaseUserId, type = 'settings') => {
    const appId = process.env.FIRESTORE_APP_ID || 'default-app-id'; // استخدم نفس appId الخاص بالواجهة الأمامية
    if (type === 'facebookUserToken') {
         return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}/tokens/facebookUserAuth`;
    }
    // يمكنك إضافة مسارات أخرى إذا احتجت لاحقًا
    return `artifacts/<span class="math-inline">\{appId\}/users/</span>{firebaseUserId}`; // مسار عام كافتراضي
};

module.exports = async (req, res) => {
  // تأكد من أن Firebase مهيأ قبل محاولة استخدام db
  if (!admin.apps.length) {
    console.error("Firebase not initialized in callback handler at request time.");
    // يجب إعادة توجيه المستخدم إلى صفحة خطأ مناسبة في الواجهة الأمامية
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(302, `${frontendUrl}/auth-failed?error=Server initialization error`);
  }

  // السماح بطلبات CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { code, state } = req.query;
  const firebaseUserId = state; // نسترجع firebaseUserId من معامل state

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'; 
  const callbackURLForTokenExchange = process.env.FACEBOOK_CALLBACK_URL; // يجب أن يكون نفس الرابط المسجل في تطبيق فيسبوك

  // التحقق من وجود المتغيرات البيئية الضرورية
  if (!callbackURLForTokenExchange) {
    console.error("FATAL ERROR: FACEBOOK_CALLBACK_URL environment variable is not set for token exchange.");
    return res.redirect(302, `${frontendUrl}/auth-failed?error=Server configuration error (callback URL missing)`);
  }
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    console.error("FATAL ERROR: Facebook App ID or Secret is not configured on the server.");
    return res.redirect(302, `${frontendUrl}/auth-failed?error=Server configuration error (FB credentials missing)`);
  }

  // التحقق من وجود code و firebaseUserId
  if (!code) {
    console.error("Facebook callback error (no code):", req.query.error_description);
    return res.redirect(302, `<span class="math-inline">\{frontendUrl\}/auth\-failed?error\=</span>{encodeURIComponent(req.query.error_description || 'Authorization denied by user')}`);
  }

  if (!firebaseUserId) {
    console.error("Firebase User ID missing in callback state.");
    return res.redirect(302, `${frontendUrl}/auth-failed?error=User session error or state missing`);
  }

  try {
    // استبدال الـ "code" بـ "رمز وصول المستخدم" (User Access Token)
    const tokenResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: callbackURLForTokenExchange,
        code: code
      }
    });
    const userAccessToken = tokenResponse.data.access_token;
    if (!userAccessToken) {
        throw new Error('Failed to retrieve user access token from Facebook.');
    }

    // تخزين "رمز وصول المستخدم" في Firestore
    const userTokenRef = db.doc(getFirestorePath(firebaseUserId, 'facebookUserToken'));
    await userTokenRef.set({
        accessToken: userAccessToken,
        grantedAt: admin.firestore.FieldValue.serverTimestamp() // استخدام Timestamp من Firebase
    });
    console.log(`User access token stored for Firebase user: ${firebaseUserId}`);

    // توجيه المستخدم إلى صفحة اختيار الصفحة في الواجهة الأمامية
    res.redirect(302, `${frontendUrl}/select-facebook-page`);

  } catch (error) {
    console.error('Error during Facebook OAuth callback:', error.response ? error.response.data : error.message);
    let errorMessage = error.message;
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        // محاولة الحصول على رسالة الخطأ من فيسبوك إذا كانت متاحة
        errorMessage = error.response.data.error.message;
    }
    res.redirect(302, `<span class="math-inline">\{frontendUrl\}/auth\-failed?error\=</span>{encodeURIComponent(errorMessage)}`);
  }
};
