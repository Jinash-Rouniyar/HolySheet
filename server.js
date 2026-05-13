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

// Request logging middleware for all /api/sheet/* routes
app.use("/api/sheet", (req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === "POST" && req.body) {
    console.log("Request body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

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

// In-memory queue for spreadsheet operations (in production, use Redis or similar)
const operationQueue = [];

// POST endpoint to queue a spreadsheet operation
app.post("/api/sheet/operation", (req, res) => {
  console.log("\n=== [SHEET OPERATION REQUEST] ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body (raw):", JSON.stringify(req.body, null, 2));
  console.log("Body type:", typeof req.body);
  console.log("Body keys:", req.body ? Object.keys(req.body) : "null");
  
  // Handle both direct operation and context_data wrapped (from WebhookStep)
  let operation = req.body;
  if (operation && operation.context_data) {
    console.log("⚠️  Request wrapped in context_data, unwrapping...");
    operation = operation.context_data;
  }
  
  console.log("Extracted operation:", JSON.stringify(operation, null, 2));
  
  if (!operation || !operation.type) {
    console.log("❌ ERROR: Operation missing or missing 'type' field");
    console.log("Operation received:", operation);
    return res.status(400).json({ error: "Operation must have a 'type' field" });
  }

  const validTypes = [
    "get_sheets",
    "get_range_data",
    "set_range_data",
    "set_range_style",
    "rename_sheet",
    "create_sheet",
    "insert_rows",
    "insert_columns",
    "set_cell_dimensions",
  ];

  if (!validTypes.includes(operation.type)) {
    console.log(`❌ ERROR: Invalid operation type: ${operation.type}`);
    return res.status(400).json({ 
      error: `Invalid operation type. Must be one of: ${validTypes.join(", ")}` 
    });
  }

  const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const queuedOp = {
    id: operationId,
    operation,
    timestamp: new Date().toISOString(),
    status: "pending",
  };

  operationQueue.push(queuedOp);
  
  console.log("✅ Operation queued successfully:");
  console.log("  - ID:", operationId);
  console.log("  - Type:", operation.type);
  console.log("  - Full operation:", JSON.stringify(operation, null, 2));
  console.log("  - Queue size:", operationQueue.length);
  console.log("  - Pending operations:", operationQueue.filter(op => op.status === "pending").length);
  console.log("=== [END REQUEST] ===\n");

  res.status(200).json({ 
    success: true, 
    operationId,
    message: `Operation ${operation.type} queued successfully` 
  });
});

// GET endpoint for frontend to poll and retrieve pending operations
app.get("/api/sheet/operations/pending", (req, res) => {
  const pending = operationQueue.filter(op => op.status === "pending");
  console.log("\n=== [POLL REQUEST] ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Pending operations count:", pending.length);
  if (pending.length > 0) {
    console.log("Pending operations:");
    pending.forEach((op, idx) => {
      console.log(`  ${idx + 1}. ID: ${op.id}, Type: ${op.operation.type}, Queued: ${op.timestamp}`);
    });
  }
  console.log("Total queue size:", operationQueue.length);
  console.log("=== [END POLL] ===\n");
  res.status(200).json({ operations: pending });
});

// POST endpoint to mark operations as completed
app.post("/api/sheet/operations/complete", (req, res) => {
  const { operationIds } = req.body;
  
  console.log("\n=== [COMPLETE REQUEST] ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Operation IDs to complete:", operationIds);
  
  if (!Array.isArray(operationIds)) {
    console.log("❌ ERROR: operationIds is not an array");
    return res.status(400).json({ error: "operationIds must be an array" });
  }

  let completed = 0;
  operationIds.forEach(id => {
    const op = operationQueue.find(o => o.id === id && o.status === "pending");
    if (op) {
      op.status = "completed";
      op.completedAt = new Date().toISOString();
      completed++;
      console.log(`  ✅ Completed: ${id} (${op.operation.type})`);
    } else {
      console.log(`  ⚠️  Not found or already completed: ${id}`);
    }
  });

  console.log(`Total completed: ${completed}/${operationIds.length}`);
  console.log("Remaining pending:", operationQueue.filter(op => op.status === "pending").length);
  console.log("=== [END COMPLETE] ===\n");

  res.status(200).json({ 
    success: true, 
    completed,
    message: `Marked ${completed} operation(s) as completed` 
  });
});

// GET endpoint to clear completed operations (optional cleanup)
app.delete("/api/sheet/operations/completed", (req, res) => {
  const before = operationQueue.length;
  const filtered = operationQueue.filter(op => op.status !== "completed");
  operationQueue.length = 0;
  operationQueue.push(...filtered);
  const removed = before - operationQueue.length;
  
  res.status(200).json({ 
    success: true, 
    removed,
    message: `Cleared ${removed} completed operation(s)` 
  });
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
