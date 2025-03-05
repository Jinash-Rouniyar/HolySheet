const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const path = require('path');

// Load environment variables from the local .env file
require('dotenv').config();


const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for testing
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add a simple test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Research endpoint
app.post('/api/research', async (req, res) => {
  try {
    const { query } = req.body;
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

    if (!PERPLEXITY_API_KEY) {
      console.error('API key not found in environment variables');
      return res.status(500).json({ error: 'API key not configured' });
    }

    console.log('Making request to Perplexity API for query:', query);
    
    const requestBody = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are a data extraction assistant. Extract the requested data and return it as a clean JSON object with the following structure ONLY. Do not include any markdown code blocks, backticks, or explanatory text:

    {
      "headers": ["Column Name 1", "Column Name 2", ...],
      "data": [
        ["Value 1", "Value 2", ...],
        ["Value 1", "Value 2", ...],
        ...
      ]
    }
    
    Important rules:
    1. Do not include row numbers or indices in the headers or data
    2. Do not add any explanatory text or metadata
    3. Make sure headers are descriptive column names only
    4. Ensure data rows contain only the actual values
    5. Return only the JSON object with no additional formatting`
        },
        {
          role: 'user',
          content: query
        }
      ]
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error details:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        error: errorText,
        requestBody: requestBody
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected API response structure:', data);
      throw new Error('Invalid API response structure');
    }

    const content = data.choices[0].message.content;

    res.json({
      response: content
    });
  } catch (error) {
    console.error('Research request failed:', error);
    res.status(500).json({ 
      error: 'Research request failed',
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 