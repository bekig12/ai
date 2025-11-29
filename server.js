import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Main AI route
app.post("/ask", async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    const { question } = req.body;

    if (!question) {
      res.status(400);
      return res.json({ status: 400, error: "Question is required" });
    }

    // Send request to Groq
    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "user", content: question }
        ]
      })
    });

    const data = await aiResponse.json();
    res.status(200);
    return res.json({ status: 200, answer: data.choices[0].message.content });

  } catch (err) {
    console.error("AI request error:", err);
    res.status(500);
    return res.json({ status: 500, error: "Failed to get AI response" });
  }
});

// Node.js backend
app.post("/translate", async (req, res) => {
  const { text, sourceLangId, targetLangId } = req.body;
  const CAMB_API_KEY = "9e78e374-62ee-4c51-af2a-e5721b355563"; // keep secret

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (!text || !sourceLangId || !targetLangId) {
    res.status(400);
    return res.json({ status: 400, error: "Missing required fields" });
  }

  try {
    // 1️⃣ Create translation task
    const createRes = await fetch("https://client.camb.ai/apis/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CAMB_API_KEY
      },
      body: JSON.stringify({
        source_language: sourceLangId,
        target_language: targetLangId,
        texts: [text]
      })
    });

    const createData = await createRes.json();
    const taskId = createData.task_id;

    // 2️⃣ Poll until translation is done
    let runId = null;
    while (!runId) {
      const statusRes = await fetch(`https://client.camb.ai/apis/translate/${taskId}`, {
        headers: { "x-api-key": CAMB_API_KEY }
      });
      const status = await statusRes.json();

      if (status.status === "SUCCESS") {
        runId = status.run_id;
      } else if (status.status === "ERROR") {
        throw new Error("CAMB.AI translation failed");
      } else {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // 3️⃣ Fetch final translation result
    const resultRes = await fetch(`https://client.camb.ai/apis/translation-result/${runId}`, {
      headers: { "x-api-key": CAMB_API_KEY }
    });

    const result = await resultRes.json();
    res.status(200);
    return res.json({ status: 200, translatedText: result.texts[0] });

  } catch (err) {
    console.error("Translation error:", err);
    res.status(500);
    return res.json({ status: 500, error: "Translation failed" });
  }
});

    
// Render uses PORT env variable
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
