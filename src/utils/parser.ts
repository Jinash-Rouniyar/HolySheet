export const extractJsonFromMarkdown = (markdown: string) => {
  try {
    // First, check if the response is already valid JSON
    try {
      const directJson = JSON.parse(markdown);
      return { 
        markdown: '', // No markdown content if it's pure JSON
        jsonData: directJson 
      };
    } catch (e) {
      // Not direct JSON, continue with markdown parsing
    }
    
    // Extract content between ```json and ``` markers
    const jsonMatch = markdown.match(/```json\n([\s\S]*?)\n```/);
    
    if (jsonMatch && jsonMatch[1]) {
      // Parse only the content within the code fence
      const jsonData = JSON.parse(jsonMatch[1].trim());
      return { 
        markdown: markdown.replace(/```json\n[\s\S]*?\n```/, '').trim(), // Remove JSON block from markdown
        jsonData 
      };
    }
    
    // Try to find any JSON-like structure in the text
    const possibleJson = markdown.match(/(\{[\s\S]*\})/);
    if (possibleJson && possibleJson[1]) {
      try {
        const jsonData = JSON.parse(possibleJson[1].trim());
        return {
          markdown: markdown.replace(possibleJson[1], '').trim(),
          jsonData
        };
      } catch (e) {
        // Not valid JSON, ignore
      }
    }
    
    return { markdown, jsonData: null };
  } catch (error) {
    console.error('Error parsing JSON from markdown:', error);
    return { markdown, jsonData: null };
  }
}; 