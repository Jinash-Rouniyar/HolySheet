import * as React from 'react';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import sheetsCoreEnUs from '@univerjs/presets/preset-sheets-core/locales/en-US';
import { createUniver, LocaleType, merge, UniverInstanceType, LogLevel, defaultTheme } from '@univerjs/presets';
import { UniverMCPPlugin } from '@univerjs-pro/mcp';
import { UniverMCPUIPlugin } from '@univerjs-pro/mcp-ui';
import univerMCPUIEnUS from '@univerjs-pro/mcp-ui/locale/en-US';
import { UniverSheetMCPPlugin } from '@univerjs-pro/sheets-mcp';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';
import '@univerjs-pro/mcp-ui/lib/index.css';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<{ text: string; isUser: boolean }[]>([]);
  const [selectedRange, setSelectedRange] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const univerInstanceRef = React.useRef<ReturnType<typeof createUniver> | null>(null);
  const shouldSkipNextCleanupRef = React.useRef(import.meta.env.DEV);

  React.useEffect(() => {
    if (univerInstanceRef.current || !containerRef.current) {
      return;
    }

    let instance: ReturnType<typeof createUniver> | null = null;

    try {
      instance = createUniver({
        locale: LocaleType.EN_US,
        logLevel: LogLevel.VERBOSE,
        theme: defaultTheme,
        locales: {
          [LocaleType.EN_US]: merge(
            {},
            sheetsCoreEnUs,
            univerMCPUIEnUS,
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current,
          }),
        ],
        plugins: [
          UniverMCPPlugin,
          [
            UniverMCPUIPlugin,
            {
              showDeveloperTools: true,
            },
          ],
          UniverSheetMCPPlugin,
        ],
      });

      instance.univer.createUnit(UniverInstanceType.UNIVER_SHEET, {});
      (window as any).univerAPI = instance.univerAPI;

      univerInstanceRef.current = instance;
    } catch (error) {
      console.error('Failed to initialize Univer:', error);
    }

    return () => {
      if (!instance) {
        return;
      }

      if (shouldSkipNextCleanupRef.current) {
        shouldSkipNextCleanupRef.current = false;
        return;
      }

      instance.univer.dispose();
      if (univerInstanceRef.current === instance) {
        univerInstanceRef.current = null;
      }
    };
  }, []);

  const onSendRequest = async (userInput: string, _spreadsheetData: Record<string, string>, _selectedRange: string | null) => {
    setMessages(prevMessages => [
      ...prevMessages,
      { text: userInput, isUser: true },
    ]);
    
    setMessages(prevMessages => [
      ...prevMessages,
      { text: 'ACL agent integration coming soon...', isUser: false },
    ]);
  };


  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <div
        id="sheet-container"
        ref={containerRef}
        style={{
          height: '100%',
          width: '100%',
        }}
      />
      <Chat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(!isChatOpen)}
        onSendRequest={onSendRequest}
        messages={messages}
        selectedRange={selectedRange}
        setSelectedRange={setSelectedRange}
      />
    </div>
  );
}

export default App;