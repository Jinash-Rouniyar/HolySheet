import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './Chat.css';

interface Message {
    text: string;
    isUser: boolean;
}

interface ChatProps {
    isOpen: boolean;
    onClose: () => void;
    onSendRequest: (userInput: string, spreadsheetData: Record<string, string>, selectedRange: string | null) => void;
    messages: Message[];
    selectedRange?: string | null | undefined;
    setSelectedRange: React.Dispatch<React.SetStateAction<string>>;
}

const Chat: React.FC<ChatProps> = ({ isOpen, onClose, onSendRequest, messages, selectedRange, setSelectedRange }) => {
    const [inputValue, setInputValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const displayMessages =
        messages.length === 0
            ? [{
                text: "Hello! I'm Celina, your spreadsheet agent. How can I help you today?",
                isUser: false,
            }]
            : messages;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [displayMessages.length, displayMessages[displayMessages.length - 1]?.text]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        // App.tsx adds user message to messages state, so we just call onSendRequest
        onSendRequest(inputValue, {}, selectedRange === undefined || selectedRange === '' ? null : selectedRange);
        setInputValue('');
    };

    const handleAddContext = () => {
        try {
            const univerAPI = (window as any).univerAPI;
            if (!univerAPI) {
                console.warn('Univer API is not available');
                return;
            }

            const fWorkbook = univerAPI.getActiveWorkbook();
            if (!fWorkbook) {
                console.warn('No active workbook found');
                return;
            }

            const fWorksheet = fWorkbook.getActiveSheet();
            if (!fWorksheet) {
                console.warn('No active sheet found');
                return;
            }

            const fSelection = fWorksheet.getSelection();
            if (!fSelection) {
                console.warn('No selection found');
                return;
            }

            const activeRange = fSelection.getActiveRange();
            if (!activeRange) {
                console.warn('No active range found');
                return;
            }

            const rangeNotation = activeRange.getA1Notation();
            if (rangeNotation) {
                setSelectedRange(rangeNotation);
            }
        } catch (error) {
            console.error('Error getting cell selection:', error);
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
                    {displayMessages.map((message, index) => (
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
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
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
                                placeholder="Ask cellina to do anything"
                                className="chat-input"
                                rows={2}
                            />
                            <button type="submit" className="inline-send-button">
                                ➤
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default Chat;