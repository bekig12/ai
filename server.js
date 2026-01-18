// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// ✅ FIX: proper node-fetch v3 import for CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔐 USE ENV VARIABLE (DO NOT HARD-CODE)
const CAMB_API_KEY = process.env.CAMB_API_KEY;

// Root route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Translate function (Amharic ↔ English)
async function translate(text, sourceLang, targetLang) {
  const createRes = await fetch("https://client.camb.ai/apis/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CAMB_API_KEY
    },
    body: JSON.stringify({
      source_language: sourceLang,
      target_language: targetLang,
      texts: [text]
    })
  });

  const createData = await createRes.json();
  const taskId = createData.task_id;

  let runId = null;
  while (!runId) {
    const statusRes = await fetch(
      `https://client.camb.ai/apis/translate/${taskId}`,
      { headers: { "x-api-key": CAMB_API_KEY } }
    );

    const status = await statusRes.json();

    if (status.status === "SUCCESS") runId = status.run_id;
    else if (status.status === "ERROR") throw new Error("Translation failed");
    else await new Promise(r => setTimeout(r, 1000));
  }

  const resultRes = await fetch(
    `https://client.camb.ai/apis/translation-result/${runId}`,
    { headers: { "x-api-key": CAMB_API_KEY } }
  );

  const result = await resultRes.json();
  return result.texts[0];
}

// Main AI route
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question)
      return res.status(400).json({ error: "No question provided" });

    // 1️⃣ Amharic → English
    const englishQuestion = await translate(question, 3, 1);

    // ⚠️ IMPORTANT:
    // Replace this URL with your REAL AI provider endpoint
    const aiRes = await fetch("https://YOUR-AI-ENDPOINT-HERE", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: englishQuestion })
    });

    const aiData = await aiRes.json();
    const englishAnswer = aiData.answer;

    // 3️⃣ English → Amharic
    const amharicAnswer = await translate(englishAnswer, 1, 3);

    // 4️⃣ Send response
    res.json({ answer: amharicAnswer });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
