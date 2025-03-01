export const extractJsonFromMarkdown = (markdown: string) => {
  try {
    try {
      const directJson = JSON.parse(markdown);
      return { 
        markdown: '', 
        jsonData: directJson 
      };
    } catch (e) {
    }
    
    const jsonMatch = markdown.match(/```json\n([\s\S]*?)\n```/);
    
    if (jsonMatch && jsonMatch[1]) {
      const jsonData = JSON.parse(jsonMatch[1].trim());
      return { 
        markdown: markdown.replace(/```json\n[\s\S]*?\n```/, '').trim(), // Remove JSON block from markdown
        jsonData 
      };
    }
    
    const possibleJson = markdown.match(/(\{[\s\S]*\})/);
    if (possibleJson && possibleJson[1]) {
      try {
        const jsonData = JSON.parse(possibleJson[1].trim());
        return {
          markdown: markdown.replace(possibleJson[1], '').trim(),
          jsonData
        };
      } catch (e) {
      }
    }
    
    return { markdown, jsonData: null };
  } catch (error) {
    console.error('Error parsing JSON from markdown:', error);
    return { markdown, jsonData: null };
  }
}; 