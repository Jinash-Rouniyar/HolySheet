import * as React from 'react';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import sheetsCoreEnUs from '@univerjs/presets/preset-sheets-core/locales/en-US';
import { createUniver, LocaleType, merge, UniverInstanceType, LogLevel, defaultTheme } from '@univerjs/presets';
import '@univerjs/presets/lib/styles/preset-sheets-core.css';
import Chat from './components/Chat';
import './App.css';

// TEMPORARY: ngrok URL for testing with cloud ACL agent
// TODO: Remove this and use relative paths after testing
const API_BASE_URL = 'https://vernetta-organoleptic-unecliptically.ngrok-free.dev';

type SpreadsheetOperationType =
  | 'get_sheets'
  | 'get_range_data'
  | 'set_range_data'
  | 'set_range_style'
  | 'rename_sheet'
  | 'create_sheet'
  | 'insert_rows'
  | 'insert_columns'
  | 'set_cell_dimensions';

type BaseSpreadsheetOperation = {
  type: SpreadsheetOperationType;
};

type GetSheetsOperation = BaseSpreadsheetOperation & {
  type: 'get_sheets';
};

type GetRangeDataOperation = BaseSpreadsheetOperation & {
  type: 'get_range_data';
  sheet_id?: string;
  range: string;
};

type SetRangeDataOperation = BaseSpreadsheetOperation & {
  type: 'set_range_data';
  sheet_id?: string;
  range: string;
  data: Record<string, unknown>;
};

type SetRangeStyleOperation = BaseSpreadsheetOperation & {
  type: 'set_range_style';
  sheet_id?: string;
  range: string;
  style: {
    bold?: boolean;
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
    horizontalAlignment?: string;
    borders?: {
      top?: { style?: string; width?: number; color?: string };
      bottom?: { style?: string; width?: number; color?: string };
      left?: { style?: string; width?: number; color?: string };
      right?: { style?: string; width?: number; color?: string };
    };
  };
};

type RenameSheetOperation = BaseSpreadsheetOperation & {
  type: 'rename_sheet';
  sheet_id?: string;
  new_name: string;
};

type CreateSheetOperation = BaseSpreadsheetOperation & {
  type: 'create_sheet';
  sheet_name: string;
};

type InsertRowsOperation = BaseSpreadsheetOperation & {
  type: 'insert_rows';
  sheet_id?: string;
  start_row: number;
  count: number;
};

type InsertColumnsOperation = BaseSpreadsheetOperation & {
  type: 'insert_columns';
  sheet_id?: string;
  start_col: number;
  count: number;
};

type SetCellDimensionsOperation = BaseSpreadsheetOperation & {
  type: 'set_cell_dimensions';
  sheet_id?: string;
  dimensions: {
    columns?: { index: number; width: number }[] | Record<string, number>;
    rows?: { index: number; height: number }[] | Record<string, number>;
  };
};

type SpreadsheetOperation =
  | GetSheetsOperation
  | GetRangeDataOperation
  | SetRangeDataOperation
  | SetRangeStyleOperation
  | RenameSheetOperation
  | CreateSheetOperation
  | InsertRowsOperation
  | InsertColumnsOperation
  | SetCellDimensionsOperation;

function columnLabelToIndex(label: string): number {
  let result = 0;
  const upper = label.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i);
    if (code < 65 || code > 90) {
      return -1;
    }
    result = result * 26 + (code - 64);
  }
  return result;
}

function indexToColumnLabel(index: number): string {
  if (index < 1) return '';
  let n = index;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function extractOperationsFromText(text: string): SpreadsheetOperation[] {
  if (!text) return [];

  const operations: SpreadsheetOperation[] = [];

  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const candidateStrings: string[] = [];

  if (jsonBlockMatch && jsonBlockMatch[1]) {
    candidateStrings.push(jsonBlockMatch[1].trim());
  } else {
    candidateStrings.push(text.trim());
  }

  for (const candidate of candidateStrings) {
    try {
      const parsed = JSON.parse(candidate);

      // Debug: see raw parsed payload from ACL
      // eslint-disable-next-line no-console
      console.log('[extractOperationsFromText] parsed candidate:', parsed);

      if (parsed && typeof parsed === 'object' && parsed.operation === 'insert_data' && parsed.data) {
        let payload: any = parsed.data;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = null;
          }
        }

        if (
          payload &&
          typeof payload === 'object' &&
          typeof payload.start_cell === 'string' &&
          Array.isArray(payload.data)
        ) {
          const start = payload.start_cell;
          const match = /^([A-Za-z]+)(\d+)$/.exec(start);
          if (match) {
            const baseColLabel = match[1];
            const baseRow = parseInt(match[2], 10);
            const baseColIndex = columnLabelToIndex(baseColLabel);
            if (baseColIndex > 0 && baseRow > 0) {
              const cellMap: Record<string, unknown> = {};
              payload.data.forEach((row: unknown[], rIdx: number) => {
                if (!Array.isArray(row)) return;
                row.forEach((value: unknown, cIdx: number) => {
                  const colIndex = baseColIndex + cIdx;
                  const colLabel = indexToColumnLabel(colIndex);
                  if (!colLabel) return;
                  const addr = `${colLabel}${baseRow + rIdx}`;
                  cellMap[addr] = value;
                });
              });

              const op: SetRangeDataOperation = {
                type: 'set_range_data',
                sheet_id: payload.sheet,
                range: start,
                data: cellMap,
              };
              operations.push(op);
              // eslint-disable-next-line no-console
              console.log('[extractOperationsFromText] constructed set_range_data op from insert_data:', op);
              break;
            }
          }
        }
      }

      const opsSource =
        Array.isArray(parsed) ? parsed : parsed.operations ?? (parsed.type ? [parsed] : []);

      if (!Array.isArray(opsSource)) continue;

      for (const raw of opsSource) {
        if (!raw || typeof raw !== 'object') continue;
        const op = raw as SpreadsheetOperation;
        if (
          !op.type ||
          ![
            'get_sheets',
            'get_range_data',
            'set_range_data',
            'set_range_style',
            'rename_sheet',
            'create_sheet',
            'insert_rows',
            'insert_columns',
            'set_cell_dimensions',
          ].includes(op.type)
        ) {
          continue;
        }
        operations.push(op);
        // eslint-disable-next-line no-console
        console.log('[extractOperationsFromText] added structured op:', op);
      }

      if (operations.length > 0) {
        break;
      }
    } catch {
      continue;
    }
  }

  return operations;
}

function applySpreadsheetOperations(operations: SpreadsheetOperation[]) {
  if (!operations.length) {
    // eslint-disable-next-line no-console
    console.warn('[applySpreadsheetOperations] No operations to execute');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[applySpreadsheetOperations] Starting execution of', operations.length, 'operations');

  const univerAPI = (window as any).univerAPI;
  if (!univerAPI || typeof univerAPI.getActiveWorkbook !== 'function') {
    // eslint-disable-next-line no-console
    console.error('[applySpreadsheetOperations] univerAPI not available or getActiveWorkbook not a function');
    // eslint-disable-next-line no-console
    console.error('[applySpreadsheetOperations] univerAPI:', univerAPI);
    return;
  }

  const workbook = univerAPI.getActiveWorkbook();
  if (!workbook) {
    // eslint-disable-next-line no-console
    console.error('[applySpreadsheetOperations] No active workbook found');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[applySpreadsheetOperations] Workbook found, executing operations...');

  const sheets = typeof workbook.getSheets === 'function' ? workbook.getSheets() : [];

  const getSheetByIdOrActive = (sheetIdOrName?: string) => {
    if (!sheetIdOrName) {
      return typeof workbook.getActiveSheet === 'function' ? workbook.getActiveSheet() : null;
    }
    if (Array.isArray(sheets) && sheets.length > 0) {
      // First try to find by sheet ID
      let found = sheets.find(
        (s: any) => typeof s.getSheetId === 'function' && s.getSheetId() === sheetIdOrName,
      );
      if (found) return found;

      // If not found by ID, try to find by sheet name
      found = sheets.find(
        (s: any) => typeof s.getSheetName === 'function' && s.getSheetName() === sheetIdOrName,
      );
      if (found) return found;
    }
    // Fallback to active sheet
    return typeof workbook.getActiveSheet === 'function' ? workbook.getActiveSheet() : null;
  };

  operations.forEach((operation) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[applySpreadsheetOperations] executing operation:', operation);
      switch (operation.type) {
        case 'get_sheets': {
          // Documented API: https://reference.univer.ai/en-US/classes/FWorkbook#getsheets
          // This is primarily useful for browser-side inspection; ACL already has its own intent-level view.
          const sheetsList =
            typeof workbook.getSheets === 'function' ? workbook.getSheets() : [];
          (window as any).__univerLastGetSheets = sheetsList;
          break;
        }

        case 'get_range_data': {
          // Use documented snapshot APIs instead of guessing per-range getters.
          // Docs: getActiveSheet() + getSheet().getSnapshot()
          const op = operation as GetRangeDataOperation;
          const sheet = getSheetByIdOrActive(op.sheet_id);
          if (!sheet) break;
          const snapshot =
            typeof sheet.getSheet === 'function' && sheet.getSheet()
              ? sheet.getSheet().getSnapshot()
              : null;
          (window as any).__univerLastGetRangeData = {
            range: op.range,
            snapshot,
          };
          break;
        }

        case 'set_range_data': {
          const op = operation as SetRangeDataOperation;
          const sheet = getSheetByIdOrActive(op.sheet_id);
          if (!sheet || !op.range || !op.data) break;

          const entries = Object.entries(op.data);
          if (entries.length === 0) break;

          entries.forEach(([cell, value]) => {
            if (!cell) return;
            const range = sheet.getRange(cell);
            if (range && typeof range.setValues === 'function') {
              range.setValues([[value]]);
            }
          });
          break;
        }

        case 'set_range_style': {
          const op = operation as SetRangeStyleOperation;
          const sheet = getSheetByIdOrActive(op.sheet_id);
          if (!sheet || !op.range || !op.style) {
            // eslint-disable-next-line no-console
            console.warn('[set_range_style] Missing sheet, range, or style:', { sheet: !!sheet, range: op.range, style: !!op.style });
            break;
          }

          const range = sheet.getRange(op.range);
          if (!range) {
            // eslint-disable-next-line no-console
            console.warn('[set_range_style] Range not found:', op.range);
            break;
          }

          const style = op.style;

          // Font styles
          if (typeof style.bold === 'boolean' && typeof range.setFontWeight === 'function') {
            range.setFontWeight(style.bold ? 'bold' : null);
          }
          if (typeof style.fontSize === 'number' && typeof range.setFontSize === 'function') {
            range.setFontSize(style.fontSize);
          }
          if (style.fontColor && typeof range.setFontColor === 'function') {
            range.setFontColor(style.fontColor);
          }

          // Background color
          if (style.backgroundColor && typeof range.setBackground === 'function') {
            const bgColor = style.backgroundColor.startsWith('#')
              ? { rgb: style.backgroundColor }
              : style.backgroundColor;
            range.setBackground(bgColor);
          }

          // Horizontal alignment
          if (style.horizontalAlignment && typeof range.setHorizontalAlignment === 'function') {
            const alignment = style.horizontalAlignment.toLowerCase();
            if (alignment === 'center' || alignment === 'left' || alignment === 'right') {
              range.setHorizontalAlignment(alignment);
            }
          }

          // Borders (simplified - Univer's border API may be more complex)
          if (style.borders && typeof style.borders === 'object') {
            // Note: Univer's border API might require more complex setup
            // This is a simplified implementation
            // eslint-disable-next-line no-console
            console.log('[set_range_style] Borders requested but not fully implemented:', style.borders);
          }

          break;
        }

        case 'rename_sheet': {
          const op = operation as RenameSheetOperation;
          const sheet = getSheetByIdOrActive(op.sheet_id);
          if (!sheet || !op.new_name) break;
          if (typeof sheet.setName === 'function') {
            sheet.setName(op.new_name);
          }
          break;
        }

        case 'create_sheet': {
          const op = operation as CreateSheetOperation;
          if (!op.sheet_name) {
            // eslint-disable-next-line no-console
            console.warn('[create_sheet] Missing sheet_name');
            break;
          }
          if (typeof workbook.create === 'function') {
            // eslint-disable-next-line no-console
            console.log('[create_sheet] Creating sheet:', op.sheet_name);
            const newSheet = workbook.create(op.sheet_name, 100, 26);
            // eslint-disable-next-line no-console
            console.log('[create_sheet] Sheet created:', newSheet ? 'success' : 'failed');
            // Activate the newly created sheet
            if (newSheet && typeof workbook.setActiveSheet === 'function') {
              workbook.setActiveSheet(newSheet);
              // eslint-disable-next-line no-console
              console.log('[create_sheet] Activated sheet:', op.sheet_name);
            }
          } else {
            // eslint-disable-next-line no-console
            console.error('[create_sheet] workbook.create is not a function');
          }
          break;
        }

        case 'insert_rows': {
          const op = operation as InsertRowsOperation;
          const sheet = getSheetByIdOrActive(op.sheet_id);
          if (!sheet || typeof sheet.insertRows !== 'function') break;
          if (typeof op.start_row !== 'number' || typeof op.count !== 'number') break;
          sheet.insertRows(op.start_row, op.count);
          break;
        }

        case 'insert_columns': {
          const op = operation as InsertColumnsOperation;
          const sheet = getSheetByIdOrActive(op.sheet_id);
          if (!sheet || typeof sheet.insertColumns !== 'function') break;
          if (typeof op.start_col !== 'number' || typeof op.count !== 'number') break;
          sheet.insertColumns(op.start_col, op.count);
          break;
        }

        case 'set_cell_dimensions': {
          const op = operation as SetCellDimensionsOperation;
          const sheet = getSheetByIdOrActive(op.sheet_id);
          if (!sheet) {
            // eslint-disable-next-line no-console
            console.warn('[set_cell_dimensions] Sheet not found:', op.sheet_id);
            break;
          }

          if (op.dimensions?.columns && typeof sheet.setColumnWidth === 'function') {
            // Handle both formats: array [{ index: 0, width: 120 }] or object { "A": 120, "B": 130 }
            if (Array.isArray(op.dimensions.columns)) {
              op.dimensions.columns.forEach((col) => {
                if (
                  col &&
                  typeof col.index === 'number' &&
                  typeof col.width === 'number'
                ) {
                  sheet.setColumnWidth(col.index, col.width);
                }
              });
            } else if (typeof op.dimensions.columns === 'object') {
              // Handle object format: { "A": 120, "B": 130 }
              Object.entries(op.dimensions.columns).forEach(([colLabel, width]) => {
                if (typeof width === 'number') {
                  const colIndex = columnLabelToIndex(colLabel);
                  if (colIndex > 0) {
                    // Univer uses 0-based indexing, so subtract 1
                    sheet.setColumnWidth(colIndex - 1, width);
                  }
                }
              });
            }
          }

          if (op.dimensions?.rows && typeof sheet.setRowHeight === 'function') {
            // Handle both formats: array [{ index: 0, height: 30 }] or object { "1": 30, "2": 40 }
            if (Array.isArray(op.dimensions.rows)) {
              op.dimensions.rows.forEach((row) => {
                if (
                  row &&
                  typeof row.index === 'number' &&
                  typeof row.height === 'number'
                ) {
                  sheet.setRowHeight(row.index, row.height);
                }
              });
            } else if (typeof op.dimensions.rows === 'object') {
              // Handle object format: { "1": 30, "2": 40 }
              Object.entries(op.dimensions.rows).forEach(([rowLabel, height]) => {
                if (typeof height === 'number') {
                  const rowIndex = parseInt(rowLabel, 10);
                  if (!isNaN(rowIndex) && rowIndex > 0) {
                    // Univer uses 0-based indexing, so subtract 1
                    sheet.setRowHeight(rowIndex - 1, height);
                  }
                }
              });
            }
          }

          break;
        }

        default:
          // eslint-disable-next-line no-console
          console.warn('[applySpreadsheetOperations] Unknown operation type:', (operation as any).type);
          break;
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('[applySpreadsheetOperations] Error executing operation:', error);
      // eslint-disable-next-line no-console
      console.error('[applySpreadsheetOperations] Failed operation:', operation);
    }
  });
}

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
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current,
          }),
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

  // Poll for pending spreadsheet operations from backend
  // Use relative URL since frontend and backend are on same machine (via Vite proxy)
  React.useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const resp = await fetch('/api/sheet/operations/pending');
        if (!resp.ok) {
          // eslint-disable-next-line no-console
          console.error('[poll] Failed to fetch pending operations:', resp.status, resp.statusText);
          return;
        }

        // Check content type to ensure we got JSON, not HTML (ngrok interstitial)
        const contentType = resp.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await resp.text();
          if (text.trim().startsWith('<!DOCTYPE')) {
            // eslint-disable-next-line no-console
            console.warn('[poll] Received HTML instead of JSON (possibly ngrok interstitial). Skipping...');
            return;
          }
        }

        const data = await resp.json();
        const pendingOps = data.operations || [];

        if (pendingOps.length > 0) {
          const operations = pendingOps.map((item: any) => item.operation);
          const operationIds = pendingOps.map((item: any) => item.id);

          // eslint-disable-next-line no-console
          console.log('[poll] Found pending operations:', operations.length, operations);

          try {
            applySpreadsheetOperations(operations);

            // Mark operations as completed
            const completeResp = await fetch('/api/sheet/operations/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ operationIds }),
            });

            if (!completeResp.ok) {
              // eslint-disable-next-line no-console
              console.error('[poll] Failed to mark operations complete:', completeResp.status);
            } else {
              // eslint-disable-next-line no-console
              console.log('[poll] Successfully marked', operationIds.length, 'operations as complete');
            }
          } catch (execError: any) {
            // eslint-disable-next-line no-console
            console.error('[poll] Error executing operations:', execError);
            // eslint-disable-next-line no-console
            console.error('[poll] Operations that failed:', operations);
          }
        }
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('[poll] Polling error:', error.message, error);
      }
    }, 1000); // Poll every 1 second

    return () => clearInterval(pollInterval);
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
      const resp = await fetch(`${API_BASE_URL}/api/agent/query`, {
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

      const operations = extractOperationsFromText(acc);
      if (operations.length > 0) {
        applySpreadsheetOperations(operations);
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