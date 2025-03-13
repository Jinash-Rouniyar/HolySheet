import * as React from 'react';
import { registerLicense } from '@syncfusion/ej2-base';
import { SpreadsheetComponent, ChartType, SelectEventArgs } from '@syncfusion/ej2-react-spreadsheet';
import Chat from './components/Chat';
import axios from 'axios';
import './App.css';

// Register Syncfusion license key
if (process.env.SYNCFUSION_LICENSE) {
  registerLicense(process.env.SYNCFUSION_LICENSE);
} else {
  try {
    registerLicense('ORg4AjUWIQA/Gnt2XVhhQlJHfVxdX2dWfFN0QHNYf1R1fF9EZkwgOX1dQl9mSXxRdERiWH9bcn1RT2g=');
  } catch (error) {
    console.warn('Syncfusion license registration failed:', error);
  }
}

function App() {
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<{ text: string; isUser: boolean }[]>([]);
  const spreadsheetRef = React.useRef<SpreadsheetComponent>(null);
  const [selectedRange, setSelectedRange] = React.useState('');

  const tools = [
    {
      type: "function",
      function: {
        name: "get_additional_data",
        description: "Fetch additional data from a different worksheet to help with analysis or calculations",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_spreadsheet",
        description: "Update the spreadsheet with new data, calculations, or formatting. Use this for adding columns, calculating values, etc.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_chart",
        description: "Create a chart in the spreadsheet based on the available data",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    }
  ];

  const handleCellSelected = (args: SelectEventArgs) => {
    console.log('Cell selected with range:', args.range); // Debug log
    if (args.range) {
        setSelectedRange(args.range);
    } else {
        setSelectedRange("");
    }
  };

  const getAdditionalData = (): Record<string, string> => {
    const spreadsheet = spreadsheetRef.current;
    const data: Record<string, string> = {};
    
    if (!spreadsheet) return data;
  
    try {
        // Get all sheets
        const allSheets = spreadsheet.sheets;
        // Get active sheet index
        const activeSheetIndex = spreadsheet.activeSheetIndex;
  
        // Check if there are other sheets
        if (!allSheets || allSheets.length <= 1) {
            console.warn('No additional worksheets found');
            return data;
        }
  
        // Select the first non-active sheet
        const targetSheetIndex = activeSheetIndex === 0 ? 1 : 0;
        const targetSheet = allSheets[targetSheetIndex];
  
        // Fetch data from the target sheet
        if (targetSheet && targetSheet.rows) {
            targetSheet.rows.forEach((row: any, rowIndex: number) => {
                if (row && row.cells) {
                    row.cells.forEach((cell: any, cellIndex: number) => {
                        if (cell && cell.value !== undefined) {
                            const cellAddress = `${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}`;
                            data[cellAddress] = String(cell.value);
                        }
                    });
                }
            });
        }
    } catch (err) {
        console.error('Error getting additional spreadsheet data:', err);
    }
  
    return data;
  };
  
    const updateSpreadsheet = (data: Record<string, string>) => {
      const spreadsheet = spreadsheetRef.current;
      console.log('Updating spreadsheet with data:', data);
      
      if (spreadsheet) {
        console.log('Spreadsheet reference found, applying updates');
        Object.entries(data).forEach(([cell, value]) => {
          console.log(`Updating cell ${cell} with value ${value}`);
          spreadsheet.updateCell({ value }, cell);
        });
      } else {
        console.error('Spreadsheet reference is null, cannot update');
      }
    };
  
    const createChart = (type: ChartType, range: string) => {
      if (spreadsheetRef.current) {
        const spreadsheet = spreadsheetRef.current;
        const sheet = spreadsheet.getActiveSheet();
        
        if (sheet) {
          spreadsheet.insertChart([{
            type: type,
            range: range,
            theme: 'Material'
          }]);
        }
      }
    };

    const fetchSpreadsheetUpdates = async (userInput: string, spreadsheetData: Record<string, any>, selectedRange: string | null) => {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an expert spreadsheet assistant. Follow these rules strictly:
                1. Always respond with a JSON object containing "data" and "message".
                2. The "data" must contain cell updates with cell addresses as keys (e.g., "C2").
                3. Always enter formulas instead of pre-calculating values.
                4. Ensure new headers are placed appropriately based on context.
                5. Support operations like new column creation, row-wise calculations, derived metrics, and data formatting.
                6. Base your response only on the given spreadsheet data and user request.
                7. Provide a clear and friendly explanation in the "message" field.
                
                Example:
                Input: {"A5": "Population", "A6": 25000, "B5": "Area", "B6": 2000}
                User instruction: "Calculate density"
                Output: {"data": {"C5": "Population Density", "C6": "=A6/B6"}, "message": "Inserted formula for population density."}
                
                Respond ONLY with a JSON object containing "data" and "message". Never include explanations.`
              },
              {
                role: 'user',
                content: `User instruction: ${userInput}
                          Current spreadsheet cell values: ${JSON.stringify(spreadsheetData)}
                          ${selectedRange ? `Selected context range: ${selectedRange}` : ''}
                          Respond ONLY with a JSON object containing "data" and "message":`
              }
            ],
            temperature: 0,
            response_format: { type: "json_object" }
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
    
        console.log('Spreadsheet update API response:', response.data);
        const result = response.data.choices[0].message.content.trim();
        const { data, message } = JSON.parse(result);
    
        updateSpreadsheet(data); // Directly pass data to updateSpreadsheet
    
        return { message };
    
      } catch (error) {
        console.error('Error fetching spreadsheet updates:', error);
        return { message: "There was an error processing your request." };
      }
    };

    const fetchChartData = async (userInput: string, spreadsheetData: Record<string, any>, selectedRange: string | null) => {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an expert spreadsheet assistant specializing in data visualization. Follow these rules strictly:
                1. Always respond with a JSON object containing "data" and "message".
                2. The "data" must contain a "type" (chart type) and "range" (data range).
                3. Ensure the chart type aligns with the dataset (e.g., pie charts for categorical data, line charts for trends).
                4. Only consider the provided spreadsheet data and user instruction.
                5. Provide a friendly, clear explanation in the "message" field.
                
                Example:
                User instruction: "Create a pie chart for sales data"
                Output: {"data": {"type": "Pie", "range": "A10:B15"}, "message": "Generated a pie chart for the given sales data."}
                
                Respond ONLY with a JSON object containing "data" and "message". Never include explanations.`
              },
              {
                role: 'user',
                content: `User instruction: ${userInput}
                          Current spreadsheet cell values: ${JSON.stringify(spreadsheetData)}
                          ${selectedRange ? `Selected context range: ${selectedRange}` : ''}
                          Respond ONLY with a JSON object containing "data" and "message":`
              }
            ],
            temperature: 0,
            response_format: { type: "json_object" }
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
    
        console.log('Chart data API response:', response.data);
        const result = response.data.choices[0].message.content.trim();
        const { data, message } = JSON.parse(result);
    
        createChart(data.type, data.range); // Directly pass type and range to createChart
    
        return { message };
    
      } catch (error) {
        console.error('Error fetching chart data:', error);
        return { message: "There was an error processing your request." };
      }
    };
    
    const onSendRequest = async (userInput: string, spreadsheetData: Record<string, string>, selectedRange: string | null) => {
      console.log('User Input:', userInput);
      console.log('Spreadsheet Data:', spreadsheetData);
      console.log('Context Range:', selectedRange);
      
      try {
        // Add the user's message to the UI
        setMessages(prevMessages => [
          ...prevMessages,
          { text: userInput, isUser: true }
        ]);
        
        // Check if API key is available
        const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
        if (!apiKey) {
          console.error("OpenAI API key is missing. Check your environment variables.");
          throw new Error("OpenAI API key is not configured. Please check your environment variables.");
        }
        console.log("API Key available:", apiKey ? "Yes" : "No");
        
        // Prepare the context message
        let contextMessage = "I'm working with a spreadsheet. ";
        if (selectedRange) {
          contextMessage += `I've selected the range ${selectedRange}. `;
        }
        if (Object.keys(spreadsheetData).length > 0) {
          contextMessage += `The spreadsheet contains data: ${JSON.stringify(spreadsheetData)}`;
        }
        
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [
              {
                role: "system",
                content: `You are a helpful assistant that can analyze spreadsheet data and help users with their spreadsheet tasks. You have access to functions that can manipulate spreadsheets.

                When a user asks you to perform a spreadsheet operation:
                
                1. If you need additional data from another worksheet, call the get_additional_data function.
                
                2. If the user wants to update the spreadsheet (add columns, calculate values, etc.), call the update_spreadsheet function. 
                   This will trigger a specialized process to generate the appropriate cell updates.
                
                3. If the user wants to create a chart, call the create_chart function.
                   This will trigger a specialized process to determine the best chart type and data range.
                
                Do not try to directly provide formulas or cell updates in your response. Instead, use the appropriate function calls to handle these operations.`
              },
              {
                role: "user",
                content: contextMessage
              },
              {
                role: "user",
                content: userInput
              }
            ],
            tools: tools,
            tool_choice: "auto"
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('OpenAI API Response:', response.data);

        // Handle the response
        const message = response.data.choices[0].message;
        
        // Add the assistant's response to the UI if there's content
        if (message.content) {
          setMessages(prevMessages => [
            ...prevMessages,
            { text: message.content, isUser: false }
          ]);
        }
        
        // Handle tool calls if any
        const toolCalls = message.tool_calls || [];
        console.log('Tool calls:', toolCalls);
        
        if (toolCalls.length > 0) {
          // Add a message indicating that functions are being called
          setMessages(prevMessages => [
            ...prevMessages,
            { text: "Processing your request...", isUser: false }
          ]);
        }

        for (const call of toolCalls) {
          const functionName = call.function.name;
          console.log(`Executing ${functionName} with parameters ${call.function.arguments}`);

          if (functionName === 'get_additional_data') {
            const data = getAdditionalData();
            console.log('Additional data fetched:', data);
            
            // Add a message about the additional data
            setMessages(prevMessages => [
              ...prevMessages,
              { text: "Additional data fetched from another worksheet.", isUser: false }
            ]);
          } else if (functionName === 'update_spreadsheet') {
            console.log('Calling fetchSpreadsheetUpdates with user input:', userInput);
            const result = await fetchSpreadsheetUpdates(userInput, spreadsheetData, selectedRange);
            
            // Add a message about the update
            setMessages(prevMessages => [
              ...prevMessages,
              { text: result.message || "Spreadsheet has been updated.", isUser: false }
            ]);
          } else if (functionName === 'create_chart') {
            console.log('Calling fetchChartData with user input:', userInput);
            const result = await fetchChartData(userInput, spreadsheetData, selectedRange);
            
            // Add a message about the chart creation
            setMessages(prevMessages => [
              ...prevMessages,
              { text: result.message || "Chart has been created.", isUser: false }
            ]);
          }
        }
        
        // If there were tool calls but no content, add a generic response
        if (toolCalls.length > 0 && !message.content) {
          setMessages(prevMessages => [
            ...prevMessages,
            { text: "I've processed your request.", isUser: false }
          ]);
        }
        
      } catch (error: any) {
        console.error('Error processing request:', error);
        
        // Add more detailed error information
        let errorMessage = "There was an error processing your request.";
        if (error.response) {
          errorMessage += ` Status: ${error.response.status}`;
          console.error('Error response data:', error.response.data);
        } else if (error.request) {
          errorMessage += " No response received from the server.";
        } else {
          errorMessage += ` ${error.message}`;
        }
        
        setMessages(prevMessages => [
          ...prevMessages,
          { text: errorMessage, isUser: false }
        ]);
      }
  };
  

  const handleResearchData = async (data: any) => {
    if (!spreadsheetRef.current || !data) return;
    const spreadsheet = spreadsheetRef.current;
    const sheet = spreadsheet.getActiveSheet();
    
    if (!sheet) return;
    try {
      const arrayData = [
        data.headers,
        ...data.data
      ];
      // Get last used row index (zero-based)
      const lastRow = sheet.usedRange?.rowIndex || 0;
      // Calculate starting row
      const startRow = lastRow > 0 ? lastRow + 2 : 0;
  
      // Convert array data to cell updates
      arrayData.forEach((row: string[], rowIndex: number) => {
        row.forEach((value: string, colIndex: number) => {
          const cellAddress = `${String.fromCharCode(65 + colIndex)}${startRow + rowIndex + 1}`;
          spreadsheet.updateCell({ value }, cellAddress);
        });
      });
  
      // Set column widths
      if (arrayData[0]) {
        spreadsheet.setColWidth(0, arrayData[0].length - 1, 120);
      }
    } catch (error) {
      console.error('Error handling research data:', error);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <SpreadsheetComponent
        ref={spreadsheetRef}
        height='100%'
        width='100%'
        allowOpen={true}
        allowSave={true}
        openUrl="https://services.syncfusion.com/js/production/api/spreadsheet/open"
        saveUrl="https://services.syncfusion.com/js/production/api/spreadsheet/save"
        showFormulaBar={true}
        showRibbon={true}
        allowChart={true}
        select={handleCellSelected}
        
      />
      <Chat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(!isChatOpen)}
        onSendRequest={onSendRequest}
        messages={messages}
        onDataReceived={handleResearchData}
        selectedRange={selectedRange}
        setSelectedRange={setSelectedRange}
      />
    </div>
  );
}

export default App;