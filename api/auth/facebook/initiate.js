require('dotenv').config();

module.exports = (req, res) => {
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

  const { firebaseUserId } = req.query;
  if (!firebaseUserId) {
    return res.status(400).json({ error: 'Firebase User ID is required.' });
  }

  const scopes = ['email', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'read_insights'].join(',');
  const callbackURL = process.env.FACEBOOK_CALLBACK_URL; 

  if (!callbackURL) {
    console.error("FATAL ERROR: FACEBOOK_CALLBACK_URL environment variable is not set.");
    return res.status(500).json({ error: 'Facebook callback URL is not configured on the server.' });
  }
  if (!process.env.FACEBOOK_APP_ID) {
    console.error("FATAL ERROR: FACEBOOK_APP_ID environment variable is not set.");
    return res.status(500).json({ error: 'Facebook App ID is not configured on the server.' });
  }

  const authorizationUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=<span class="math-inline">\{process\.env\.FACEBOOK\_APP\_ID\}&redirect\_uri\=</span>{encodeURIComponent(callbackURL)}&state=<span class="math-inline">\{firebaseUserId\}&scope\=</span>{scopes}&response_type=code`;

  res.redirect(302, authorizationUrl);
};
