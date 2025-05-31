const axios = require('axios');
require('dotenv').config(); 

module.exports = async (req, res) => {
  // السماح بطلبات CORS من أي مصدر (أو يمكنك تقييده للواجهة الأمامية لاحقًا)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // معالجة طلب OPTIONS (preflight) الذي يرسله المتصفح قبل الطلب الرئيسي
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // التأكد أن الطلب هو POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = req.body; // استخلاص الـ "prompt" من جسم الطلب

  // التحقق من وجود الـ "prompt"
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  // التحقق من وجود مفتاح Gemini API (سيتم تحميله كمتغير بيئي في Vercel)
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
    return res.status(500).json({ error: 'AI service is not configured.' });
  }

  try {
    // إرسال الطلب إلى Gemini API
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      { headers: { 'Content-Type': 'application/json' } }
    );

    // التحقق من بنية الرد وإرسال النص المُنشأ
    if (geminiResponse.data.candidates && geminiResponse.data.candidates.length > 0 &&
        geminiResponse.data.candidates[0].content && geminiResponse.data.candidates[0].content.parts &&
        geminiResponse.data.candidates[0].content.parts.length > 0) {
      res.status(200).json({ generatedText: geminiResponse.data.candidates[0].content.parts[0].text });
    } else {
      console.error("Unexpected Gemini API response structure:", geminiResponse.data);
      res.status(500).json({ error: "Failed to get valid content from Gemini API or unexpected structure."});
    }
  } catch (error) {
    // معالجة الأخطاء عند الاتصال بـ Gemini API
    console.error('Error calling Gemini API:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: `Failed to generate content from AI. ${error.message}` });
  }
};
