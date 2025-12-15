const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "build")));
}

app.get("/api", (req, res) => {
  res.json({ message: "Server is running" });
});

async function createDatastore(api_key) {
  const datastorePayload = {
    name: "Spreadsheet Datastore",
    configuration: {
      parsing: {
        figure_caption_mode: "default",
        enable_split_tables: true,
        max_split_table_cells: 100,
      },
      chunking: {
        chunking_mode: "hierarchy_depth",
        max_chunk_length_tokens: 768,
        min_chunk_length_tokens: 384,
        enable_hierarchy_based_contextualization: true,
      },
      html_config: { max_chunk_length_tokens: 768 },
    },
  };

  const response = await fetch("https://api.contextual.ai/v1/datastores", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(datastorePayload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create datastore: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  if (!data.id) {
    throw new Error("No datastore ID returned from datastore creation");
  }
  return data.id;
}

app.post("/api/create-datastore", async (req, res) => {
  const api_key = process.env.CONTEXTUALAI_API_KEY;
  if (!api_key) {
    console.error("API key not found in environment variables");
    res.status(500).json({ error: "API key not configured" });
    return;
  }

  try {
    const id = await createDatastore(api_key);
    res.status(200).json({ id });
  } catch (err) {
    console.error("Error creating datastore:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/create-agent", async (req, res) => {
  const api_key = process.env.CONTEXTUALAI_API_KEY;
  if (!api_key) {
    console.error("API key not found in environment variables");
    res.status(500).json({ error: "API key not configured" });
    return;
  }

  let datastore_id;
  try {
    datastore_id = await createDatastore(api_key);
  } catch (err) {
    console.error("Error creating datastore:", err);
    res.status(500).json({ error: "Error creating datastore: " + err.message });
    return;
  }

  const yaml_path = path.join(__dirname, "spreadsheet.yaml");
  if (!fs.existsSync(yaml_path)) {
    console.error("YAML file not found");
    res.status(500).json({ error: "YAML file not found" });
    return;
  }

  const acl_yaml_raw = fs.readFileSync(yaml_path, "utf8");

  const payload = {
    name: "Spreadsheet Agent",
    description: "A helpful agent that can help you with your questions.",
    datastore_ids: [datastore_id],
    agent_configs: {
      acl_config: {
        acl_active: true,
        acl_yaml: acl_yaml_raw,
      },
    },
  };

  try {
    const response = await fetch("https://api.contextual.ai/v1/agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    res.status(response.status).json(result);
  } catch (err) {
    console.error("Error creating agent:", err);
    res.status(500).json({ error: "Error creating agent: " + err.message });
  }
});

app.post("/api/agent/query", async (req, res) => {
  // const api_key = process.env.CONTEXTUALAI_API_KEY;
  const api_key = "key-Z6-0NA6Xlb-pTuTuiGZ5frNW6-2OloW7vdPpoCT9q6Tz8VZe4";
  const agent_id =
    process.env.CONTEXTUALAI_AGENT_ID ||
    "f49a22bd-0075-4c8f-a791-4674712070eb";

  if (!api_key) {
    return res.status(500).json({ error: "CONTEXTUALAI_API_KEY is not set" });
  }

  const { prompt, conversationId } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const upstream = await fetch(
      `https://api.contextual.ai/v1/agents/${agent_id}/query/acl`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          stream: true,
          ...(conversationId ? { conversation_id: conversationId } : {}),
        }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: text || "Upstream error" })}\n\n`
      );
      return res.end();
    }

    const readable =
      upstream.body && typeof upstream.body.getReader === "function"
        ? Readable.fromWeb(upstream.body)
        : upstream.body;

    if (!readable || typeof readable.on !== "function") {
      const text = await upstream.text();
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: text || "Upstream stream error" })}\n\n`
      );
      return res.end();
    }

    readable.on("data", (chunk) => {
      res.write(chunk);
    });

    readable.on("end", () => {
      res.end();
    });

    readable.on("error", (err) => {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  }
});

app.get("*", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  } else {
    res.json({
      message: "In development mode, this would serve the React app",
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
