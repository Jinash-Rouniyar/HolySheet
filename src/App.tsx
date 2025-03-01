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

  const handleCellSelected = (args: SelectEventArgs) => {
    console.log('Cell selected with range:', args.range); // Debug log
    if (args.range) {
        setSelectedRange(args.range);
    } else {
        setSelectedRange("");
    }
  };

  const onSendRequest = async (userInput: string, spreadsheetData: Record<string, string>, selectedRange: string | null) => {
    try {
      console.log('User Input:', userInput);
      console.log('Spreadsheet Data:', spreadsheetData);
      console.log('Context Range:', selectedRange);
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions', // Updated endpoint
        {
          model: 'gpt-4o-mini', // Updated model
          messages: [
            {
              "role": "system",
              "content": `You are an expert spreadsheet assistant. Follow these rules strictly:
              1. Always respond with a JSON object containing a "tag", "data", and "message".
              2. The "tag" indicates the action: "draw" for drawing charts, "insert" for inserting formulas or values, or "info" for messages.
              3. The "data" contains cell updates or chart specifications.
              4. Always respond with a JSON object using cell addresses as keys (e.g., "C2").
              5. When performing calculations, always enter formulas instead of pre-calculating values. Ensure formulas use standard spreadsheet functions.
              6. Headers must be placed in the appropriate row within the table rather than always being in row 1.
              7. Analyze existing headers and the provided context to determine appropriate placement for new columns/rows.
              8. Support these operations automatically:
                 - New column creation
                 - Row-wise calculations
                 - Derived metrics
                 - Data formatting
                 - Error checking
              9. If additional context is provided, ensure that any updates or calculations are based on the user's request. If the user's request is to modify the data based on only the given context, use only the given context. If the user asks to modify the data based on both the spreadsheet and provided context, take both into consideration.
              10. Provide a friendly, detailed and explanatory messages in the "message" field based on the user's request and how did you tackle it.
            
              Example 1: Population Density Calculation
              Input data: {"A5": "Population", "A6": 25000, "B5": "Area", "B6": 2000}
              User instruction: "Calculate density"
              Output: {"tag": "insert", "data": {"C5": "Population Density", "C6": "=A6/B6"}, "message": "Inserted formula for population density calculation."}
            
              Example 2: Sales Tax Addition
              Input data: {"D10": "Price", "D11": 100, "D12": 150}
              User instruction: "Add 8% tax"
              Output: {"tag": "insert", "data": {"E10": "Tax", "E11": "=D11*0.08", "E12": "=D12*0.08", "F10": "Total", "F11": "=D11+E11", "F12": "=D12+E12"}, "message": "Inserted formulas to calculate tax and total price."}
            
              Example 3: Chart Creation
              User instruction: "Create a pie chart for sales data"
              Output: {"tag": "draw", "data": {"type": "Pie", "range": "A10:B15"}, "message": "Generated a pie chart for the given sales data."}
            
              Respond ONLY with valid JSON containing the "tag", "data", and "message". Never include explanations.`
            },
            {
              role: 'user',
              content: `User instruction: ${userInput}
                        Current spreadsheet cell values: ${JSON.stringify(spreadsheetData)}
                        ${selectedRange ? `Selected context range: ${selectedRange}` : ''}
                        Respond ONLY with a JSON object containing a "tag", "data", and "message":`
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

      const result = response.data.choices[0].message.content.trim();
      console.log('LLM Output:', result);

      const { tag, data, message } = JSON.parse(result);

      setMessages(prevMessages => [
        ...prevMessages,
        { text: userInput, isUser: true },
        { text: message, isUser: false }
      ]);

      if (tag === 'draw') {
        const { type, range } = data;
        createChart(type, range);
      } else if (tag === 'insert') {
        updateSpreadsheet(data);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      setMessages(prevMessages => [
        ...prevMessages,
        { text: "There was an error processing your request.", isUser: false }
      ]);
    }
  };

  const updateSpreadsheet = (data: Record<string, string>) => {
    const spreadsheet = spreadsheetRef.current;
    if (spreadsheet) {
      Object.entries(data).forEach(([cell, value]) => {
        spreadsheet.updateCell({ value }, cell);
      });
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

  const handleResearchData = async (data: any) => {
    if (!spreadsheetRef.current || !data) return;

    const spreadsheet = spreadsheetRef.current;
    const sheet = spreadsheet.getActiveSheet();
    
    if (!sheet) return;

    try {
      // Clear the current sheet
      spreadsheet.clear({ type: 'Clear All' });

      // Prepare the data array with headers
      const arrayData = [
        data.headers,
        ...data.data
      ];

      // Import the data into the spreadsheet
      spreadsheet.insertSheet([{
        ranges: [{
          dataSource: arrayData,
          showFieldAsHeader: true
        }]
      }]);

      // Set reasonable column widths
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
