const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

require('dotenv').config();

const app = express();

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
}

app.get('/api', (req, res) => {
  res.json({ message: 'Server is running' });
});


app.post('/api/create-agent', async (req, res) => {
async function createDatastore(api_key) {
  const datastorePayload = {
    name: "Spreadsheet Datastore",
    configuration: {
      parsing: {
        figure_caption_mode: 'default',
        enable_split_tables: true,
        max_split_table_cells: 100
      },
      chunking: {
        chunking_mode: 'hierarchy_depth',
        max_chunk_length_tokens: 768,
        min_chunk_length_tokens: 384,
        enable_hierarchy_based_contextualization: true
      },
      html_config: { max_chunk_length_tokens: 768 }
    }
  };

  const response = await fetch('https://api.contextual.ai/v1/datastores', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(datastorePayload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create datastore: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  if (!data.id) {
    throw new Error('No datastore ID returned from datastore creation');
  }
  return data.id;
}

app.post('/api/create-datastore', async (req, res) => {
  const api_key = process.env.CONTEXTUALAI_API_KEY;
  if (!api_key) {
    console.error('API key not found in environment variables');
    res.status(500).json({ error: 'API key not configured' });
    return;
  }

  try {
    const id = await createDatastore(api_key);
    res.status(200).json({ id });
  } catch (err) {
    console.error('Error creating datastore:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/create-agent', async (req, res) => {
  const api_key = process.env.CONTEXTUALAI_API_KEY;
  if (!api_key) {
    console.error('API key not found in environment variables');
    res.status(500).json({ error: 'API key not configured' });
    return;
  }

  let datastore_id;
  try {
    datastore_id = await createDatastore(api_key);
  } catch (err) {
    console.error('Error creating datastore:', err);
    res.status(500).json({ error: 'Error creating datastore: ' + err.message });
    return;
  }

  const yaml_path = path.join(__dirname, 'spreadsheet.yaml');
  if (!fs.existsSync(yaml_path)) {
    console.error('YAML file not found');
    res.status(500).json({ error: 'YAML file not found' });
    return;
  }

  const acl_yaml_raw = fs.readFileSync(yaml_path, 'utf8');

  const payload = {
    "name": "Spreadsheet Agent",
    "description": "A helpful agent that can help you with your questions.",
    "datastore_ids": [datastore_id],
    "agent_configs": {
      "acl_config": {
        "acl_active": true,
        "acl_yaml": acl_yaml_raw
      }
    }
  };

  try {
    const response = await fetch('https://api.contextual.ai/v1/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    res.status(response.status).json(result);
  } catch (err) {
    console.error('Error creating agent:', err);
    res.status(500).json({ error: 'Error creating agent: ' + err.message });
  }
});

app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  } else {
    res.json({ message: 'In development mode, this would serve the React app' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
});