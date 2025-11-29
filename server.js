const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const CAMB_API_KEY = "9e78e374-62ee-4c51-af2a-e5721b355563";

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
        const statusRes = await fetch(`https://client.camb.ai/apis/translate/${taskId}`, {
            headers: { "x-api-key": CAMB_API_KEY }
        });
        const status = await statusRes.json();
        if (status.status === "SUCCESS") runId = status.run_id;
        else if (status.status === "ERROR") throw new Error("Translation failed");
        else await new Promise(r => setTimeout(r, 1000));
    }

    const resultRes = await fetch(`https://client.camb.ai/apis/translation-result/${runId}`, {
        headers: { "x-api-key": CAMB_API_KEY }
    });
    const result = await resultRes.json();
    return result.texts[0];
}

// AI endpoint
app.post("/ask", async (req, res) => {
    try {
        const amharicText = req.body.text;
        if (!amharicText) return res.status(400).json({ error: "No text provided" });

        // 1️⃣ Translate Amharic → English
        const englishText = await translate(amharicText, 3, 1);

        // 2️⃣ Ask AI (replace with your AI endpoint)
        const aiRes = await fetch("https://ai-f7pq.onrender.com/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: englishText })
        });
        const aiData = await aiRes.json();
        const englishAnswer = aiData.answer;

        // 3️⃣ Translate English → Amharic
        const amharicAnswer = await translate(englishAnswer, 1, 3);

        // 4️⃣ Return Amharic answer to frontend
        res.json({ answer: amharicAnswer });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
