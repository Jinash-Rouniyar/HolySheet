export const extractJsonFromMarkdown = (markdown: string) => {
  try {
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
    
    return { markdown, jsonData: null };
  } catch (error) {
    console.error('Error parsing JSON from markdown:', error);
    return { markdown, jsonData: null };
  }
}; 