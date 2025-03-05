interface PerplexityResponse {
  response: string;
  structuredData: any;
}

export async function handleResearchRequest(query: string): Promise<PerplexityResponse> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    throw new Error('Perplexity API key not found');
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant that helps analyze data and convert it into structured format. Always try to extract numerical or categorical data that can be represented in a spreadsheet. Return your response in a format that includes both a natural language explanation and structured JSON data.'
          },
          {
            role: 'user',
            content: `Research the following and provide both an explanation and structured data that can be used in a spreadsheet: ${query}`
          }
        ],
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from Perplexity API');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the response to separate the explanation and structured data
    let structuredData;
    let explanation = content;

    // Try to extract JSON from the response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        structuredData = JSON.parse(jsonMatch[1]);
        explanation = content.replace(/```json\n[\s\S]*?\n```/, '').trim();
      } catch (e) {
        console.error('Failed to parse JSON from response');
      }
    }

    return {
      response: explanation,
      structuredData
    };
  } catch (error) {
    console.error('Research request failed:', error);
    throw error;
  }
} 