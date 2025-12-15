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
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const assistantIndexRef = React.useRef<number | null>(null);
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
    // Insert user message and a placeholder assistant message; record assistant index immediately
    setMessages(prev => {
      const assistantIndex = prev.length + 1;
      assistantIndexRef.current = assistantIndex;
      return [...prev, { text: userInput, isUser: true }, { text: '', isUser: false }];
    });

    const prompt = selectedRange ? `Range ${selectedRange}: ${userInput}` : userInput;

    const updateAssistant = (text: string) => {
      const idx = assistantIndexRef.current;
      if (idx == null) return;
      setMessages(prev => {
        const next = [...prev];
        next[idx] = { text, isUser: false };
        return next;
      });
    };

    let acc = '';
    let eventsLog = '';
    const combine = () => (eventsLog ? `${acc}\n\n${eventsLog}` : acc);
    const appendEvent = (note: string) => {
      eventsLog += eventsLog ? `\n${note}` : note;
      updateAssistant(combine());
    };

    try {
      const resp = await fetch('/api/agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, conversationId }),
      });

      if (!resp.body) {
        throw new Error('No response body from server');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Support both \n\n and \r\n\r\n delimiters
        const splitRegex = /\r?\n\r?\n/;
        const parts = buffer.split(splitRegex);
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split(/\r?\n/);
          let event = 'message';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('data:')) data += line.slice(5).trim();
          }

          if (!data) continue;

          try {
            const parsed = JSON.parse(data);
            const evt = parsed.event || event;
            const evtData = parsed.data || parsed;

            if (evt === 'metadata' && evtData.conversation_id) {
              setConversationId(evtData.conversation_id);
            } else if (evt === 'message_delta' && evtData.delta) {
              acc += evtData.delta;
              updateAssistant(combine());
            } else if (evt === 'message_complete' && evtData.final_message) {
              acc = evtData.final_message;
              updateAssistant(combine());
            } else if (evt === 'outputs' && evtData.response) {
              acc = evtData.response;
              updateAssistant(combine());
            } else if (evt === 'error') {
              appendEvent(`[error] ${evtData.message || 'Unknown error'}`);
            } else if (evt === 'dynamic_thinking_start') {
              appendEvent('[thinking]');
            } else if (evt === 'dynamic_thinking_delta' && evtData.delta) {
              appendEvent(evtData.delta);
            } else if (evt === 'dynamic_thinking_end') {
              appendEvent('[thinking done]');
            } else if (evt === 'dynamic_tool_call_created') {
              appendEvent(`[tool start] ${evtData.tool_name || 'tool'}`);
            } else if (evt === 'dynamic_tool_call_end') {
              appendEvent(`[tool end]`);
            } else if (evt === 'stepping' && evtData.type) {
              appendEvent(`[step] ${evtData.type}`);
            }
          } catch {
            acc += data;
            updateAssistant(combine());
          }
        }
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { text: `Request failed: ${error.message}`, isUser: false }]);
    }
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