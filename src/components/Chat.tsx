import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './Chat.css';
import { extractJsonFromMarkdown } from '../utils/parser';

interface Message {
    text: string;
    isUser: boolean;
    jsonData?: any;
}

interface ChatProps {
    isOpen: boolean;
    onClose: () => void;
    onSendRequest: (userInput: string, spreadsheetData: Record<string, string>, selectedRange: string | null) => void;
    messages: Message[];
    onDataReceived?: (data: any) => void;
    selectedRange?: string | null | undefined;
    setSelectedRange: React.Dispatch<React.SetStateAction<string>>;
}

const Chat: React.FC<ChatProps> = ({ isOpen, onClose, onSendRequest, messages, onDataReceived, selectedRange, setSelectedRange }) => {
    const [inputValue, setInputValue] = useState('');
    const [isResearchMode, setIsResearchMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [localMessages, setLocalMessages] = useState<Message[]>([
        {
            text: "Hello! I'm Celina, your spreadsheet agent. How can I help you today?",
            isUser: false
        }
    ]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (messages.length > 0) {
            setLocalMessages(prev => {
                // Keep welcome message if it's the only message
                if (prev.length === 1 && !prev[0].isUser) {
                    return [...prev, ...messages];
                }
                return messages;
            });
        }
    }, [messages]);

    // Auto-resize textarea
    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.max(textarea.scrollHeight, 56)}px`;
        }
    };

    useEffect(() => {
        adjustTextareaHeight();
    }, [inputValue]);

    const performResearch = async (query: string) => {
        setIsLoading(true);
        try {
            // Use relative URL instead of absolute URL
            const endpoint = '/api/research';
            
            console.log('Making research request to:', endpoint);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers));
            
            // Check if response is OK before trying to parse JSON
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API error response:', errorText);
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            // Try to parse the JSON response
            let data;
            try {
                data = await response.json();
                console.log('Parsed API response:', data);
            } catch (parseError: unknown) {
                const responseText = await response.text();
                console.error('JSON parse error. Raw response:', responseText);
                throw new Error(`Failed to parse API response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }

            const { markdown, jsonData } = extractJsonFromMarkdown(data.response);

            const researchResponse: Message = {
                text: markdown,
                isUser: false,
                jsonData,
            };

            setLocalMessages(prev => [...prev, researchResponse]);

            if (jsonData && onDataReceived) {
                onDataReceived(jsonData);
            }
        } catch (error) {
            console.error('Research error:', error);
            setLocalMessages(prev => [...prev, {
                text: error instanceof Error
                    ? `Error: ${error.message}`
                    : 'An unexpected error occurred while researching. Please try again.',
                isUser: false,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const newMessage: Message = {
            text: inputValue,
            isUser: true,
        };

        setLocalMessages(prev => [...prev, newMessage]);

        if (isResearchMode) {
            await performResearch(inputValue);
        } else {
            onSendRequest(inputValue, getSpreadsheetData(), selectedRange === undefined ? null : selectedRange);
        }

        setInputValue('');
    };

    const getSpreadsheetData = (): Record<string, string> => {
        const spreadsheet = document.querySelector('.e-spreadsheet') as any;
        const data: Record<string, string> = {};
        if (spreadsheet) {
            const sheet = spreadsheet.ej2_instances[0].sheets[0];
            sheet.rows.forEach((row: any, rowIndex: number) => {
                if (row && row.cells) {
                    row.cells.forEach((cell: any, cellIndex: number) => {
                        if (cell && cell.value) {
                            const cellAddress = `${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}`;
                            data[cellAddress] = cell.value;
                        }
                    });
                }
            });
        }
        return data;
    };

    const handleAddContext = () => {
      if (selectedRange) {
        setSelectedRange((prevRange) => selectedRange);
      }
  };

  const handleClearContext = () => {
      setSelectedRange("");
  };

    return (
        <>
            <button className="chat-toggle" onClick={onClose}>
                <div className="chat-toggle-icon">
                    {isOpen ? '▶' : '◀'}
                </div>
            </button>
            <div className={`chat-container ${isOpen ? 'open' : ''}`}>
                <div className="chat-header">
                    <h3>Celina</h3>
                    <button onClick={onClose} className="close-button">×</button>
                </div>
                <div className="chat-messages">
                    {localMessages.map((message, index) => (
                        <div
                            key={index}
                            className={`message ${message.isUser ? 'user-message' : 'assistant-message'}`}
                        >
                            <div className="message-content">
                                {message.isUser ? (
                                    message.text
                                ) : (
                                    <ReactMarkdown>{message.text}</ReactMarkdown>
                                )}
                                {message.jsonData && (
                                    <div className="data-preview">
                                        <div className="data-preview-header">
                                            <span>Data Preview</span>
                                            <button
                                                className="populate-button"
                                                onClick={() => onDataReceived?.(message.jsonData)}
                                            >
                                                Populate Spreadsheet
                                            </button>
                                        </div>
                                        <div className="data-table">
                                            {message.jsonData.headers && (
                                                <div className="table-row header">
                                                    {message.jsonData.headers.map((header: string, i: number) => (
                                                        <div key={i} className="table-cell">{header}</div>
                                                    ))}
                                                </div>
                                            )}
                                            {message.jsonData.data && message.jsonData.data.map((row: any[], i: number) => (
                                                <div key={i} className="table-row">
                                                    {row.map((cell, j) => (
                                                        <div key={j} className="table-cell">{cell}</div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="loading-indicator">
                            Researching...
                        </div>
                    )}
                </div>
                <div className="chat-footer">
                    <div className="context-controls">
                        {selectedRange ? (
                            <div className="context-wrapper">
                                <div className="context-indicator">{selectedRange}</div>
                                <button className="clear-context-button" onClick={handleClearContext}>×</button>
                            </div>
                        ) : (
                            !selectedRange && (
                                <button className="add-context-thin" onClick={handleAddContext}>
                                    + Add Cell Context
                                </button>
                            )
                        )}
                        <div className="research-toggle">
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={isResearchMode}
                                    onChange={() => setIsResearchMode(!isResearchMode)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                            <span className="toggle-label">Deep Search</span>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="chat-input-container">
                        <div className="input-wrapper">
                            <textarea
                                ref={textareaRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder={isResearchMode ? "Ask anything to research..." : "Ask cellina to do anything"}
                                className="chat-input"
                                rows={2}
                            />
                            <button type="submit" className="inline-send-button" disabled={isLoading}>
                                {isLoading ? '...' : '➤'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default Chat;