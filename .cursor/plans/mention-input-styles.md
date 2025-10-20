
## Tab Mention Styling Components

### 1. Mention Input Field

#### Base Input Styling
```css
.mention-input {
  /* Base styling from existing system */
  background: #1a1a1a;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  min-height: 48px;
  transition: all 0.2s ease;
}

.mention-input:focus {
  border-color: #00f8f1;
  box-shadow: 0 0 0 2px rgba(0, 248, 241, 0.2);
  outline: none;
}
```

#### Mention Chip Styling
```css
.mention-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, rgba(0, 248, 241, 0.15), rgba(169, 0, 255, 0.1));
  border: 1px solid rgba(0, 248, 241, 0.3);
  border-radius: 20px;
  padding: 4px 8px 4px 12px;
  margin: 2px 4px 2px 0;
  font-size: 13px;
  font-weight: 500;
  color: #00f8f1;
  backdrop-filter: blur(10px);
  position: relative;
  transition: all 0.2s ease;
  cursor: pointer;
}

.mention-chip:hover {
  background: linear-gradient(135deg, rgba(0, 248, 241, 0.25), rgba(169, 0, 255, 0.15));
  border-color: rgba(0, 248, 241, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 248, 241, 0.2);
}

.mention-chip::before {
  content: '@';
  font-weight: 600;
  color: rgba(0, 248, 241, 0.8);
  margin-right: 2px;
}

.mention-chip .tab-favicon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.mention-chip .tab-title {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-chip .remove-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s ease;
  margin-left: 4px;
}

.mention-chip .remove-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  transform: scale(1.1);
}
```

### 2. Tab Dropdown Menu

#### Dropdown Container
```css
.mention-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(26, 26, 26, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(0, 248, 241, 0.1);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 4px;
  animation: dropdownFadeIn 0.2s ease-out;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mention-dropdown::-webkit-scrollbar {
  width: 6px;
}

.mention-dropdown::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.mention-dropdown::-webkit-scrollbar-thumb {
  background: rgba(0, 248, 241, 0.3);
  border-radius: 3px;
}

.mention-dropdown::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 248, 241, 0.5);
}
```

#### Tab Item Styling
```css
.tab-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
}

.tab-item:last-child {
  border-bottom: none;
}

.tab-item:hover {
  background: linear-gradient(90deg, rgba(0, 248, 241, 0.1), transparent);
  border-left: 3px solid #00f8f1;
}

.tab-item.selected {
  background: linear-gradient(90deg, rgba(0, 248, 241, 0.15), transparent);
  border-left: 3px solid #00f8f1;
}

.tab-item .tab-favicon {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.tab-item .tab-info {
  flex: 1;
  min-width: 0;
}

.tab-item .tab-title {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-item .tab-url {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-item .tab-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00f8f1;
  box-shadow: 0 0 8px rgba(0, 248, 241, 0.5);
  flex-shrink: 0;
  animation: statusPulse 2s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}
```

### 3. Search/Filter Input

#### Search Input in Dropdown
```css
.mention-search {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  background: rgba(26, 26, 26, 0.95);
  backdrop-filter: blur(20px);
  z-index: 10;
}

.mention-search input {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  transition: all 0.2s ease;
}

.mention-search input:focus {
  border-color: #00f8f1;
  box-shadow: 0 0 0 2px rgba(0, 248, 241, 0.2);
  outline: none;
}

.mention-search input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
```

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './TabMentionInput.css';

// Types
interface Tab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

interface Mention {
  display: string;
  id: string;
  type: 'tab' | 'tool';
}

interface TabMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Main Component
export const TabMentionInput: React.FC<TabMentionInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder = "Type a message...",
  disabled = false
}) => {
  // State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const inputRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch tabs from Chrome API
  const fetchTabs = useCallback(async () => {
    try {
      setIsLoading(true);
      const tabs = await chrome.tabs.query({});
      const formattedTabs = tabs.map(tab => ({
        id: tab.id!,
        title: tab.title || 'Untitled',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl
      }));
      setTabs(formattedTabs);
    } catch (error) {
      console.error('Failed to fetch tabs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter tabs based on search query
  const filteredTabs = useMemo(() => {
    if (!searchQuery) return tabs;
    return tabs.filter(tab => 
      tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tab.url.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tabs, searchQuery]);

  // Extract mentions from text
  const extractMentions = useCallback((text: string): Mention[] => {
    const mentions: Mention[] = [];
    const tabMentionRegex = /@\[([^\]]+)\]\((\d+)\)/g;
    const toolMentionRegex = /#\[([^\]]+)\]\(([^\)]+)\)/g;
    
    let match;
    while ((match = tabMentionRegex.exec(text)) !== null) {
      mentions.push({ display: match[1], id: match[2], type: 'tab' });
    }
    
    while ((match = toolMentionRegex.exec(text)) !== null) {
      mentions.push({ display: match[1], id: match[2], type: 'tool' });
    }
    
    return mentions;
  }, []);

  // Get cursor position in contenteditable
  const getCursorPosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(inputRef.current!);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  }, []);

  // Set cursor position in contenteditable
  const setCursorPositionInInput = useCallback((position: number) => {
    const selection = window.getSelection();
    if (!selection || !inputRef.current) return;

    const range = document.createRange();
    const textNode = inputRef.current.firstChild;
    
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const maxPosition = textNode.textContent?.length || 0;
      const clampedPosition = Math.min(position, maxPosition);
      range.setStart(textNode, clampedPosition);
      range.setEnd(textNode, clampedPosition);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  // Handle input changes
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const newValue = e.currentTarget.textContent || '';
    onChange(newValue);
    
    const position = getCursorPosition();
    setCursorPosition(position);
    
    // Check for @ trigger
    const textBeforeCursor = newValue.substring(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if we're in a mention context (no space after @)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('[')) {
        setMentionStart(lastAtIndex);
        setSearchQuery(textAfterAt);
        setIsDropdownOpen(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    // Close dropdown if not in mention context
    if (mentionStart !== null) {
      setMentionStart(null);
      setIsDropdownOpen(false);
      setSearchQuery('');
    }
  }, [onChange, getCursorPosition, mentionStart]);

  // Insert mention into input
  const insertMention = useCallback((tab: Tab) => {
    if (!inputRef.current || mentionStart === null) return;
    
    const currentValue = inputRef.current.textContent || '';
    const beforeMention = currentValue.substring(0, mentionStart);
    const afterMention = currentValue.substring(cursorPosition);
    const mentionText = `@[${tab.title}](${tab.id})`;
    
    const newValue = beforeMention + mentionText + afterMention;
    onChange(newValue);
    
    // Update the input content
    inputRef.current.textContent = newValue;
    
    // Set cursor position after the mention
    const newCursorPosition = beforeMention.length + mentionText.length;
    setCursorPositionInInput(newCursorPosition);
    
    // Close dropdown and reset state
    setIsDropdownOpen(false);
    setMentionStart(null);
    setSearchQuery('');
    setSelectedIndex(0);
  }, [onChange, mentionStart, cursorPosition, setCursorPositionInInput]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isDropdownOpen) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend(value);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredTabs.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredTabs.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredTabs[selectedIndex]) {
          insertMention(filteredTabs[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setMentionStart(null);
        setSearchQuery('');
        setSelectedIndex(0);
        break;
      case 'Backspace':
        if (mentionStart !== null && cursorPosition <= mentionStart + 1) {
          e.preventDefault();
          setIsDropdownOpen(false);
          setMentionStart(null);
          setSearchQuery('');
        }
        break;
    }
  }, [isDropdownOpen, filteredTabs, selectedIndex, insertMention, value, onSend, mentionStart, cursorPosition]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setMentionStart(null);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch tabs on mount
  useEffect(() => {
    fetchTabs();
  }, [fetchTabs]);

  // Render mention chips
  const renderMentions = useCallback(() => {
    const mentions = extractMentions(value);
    if (mentions.length === 0) return null;

    return (
      <div className="mention-chips">
        {mentions.map((mention, index) => (
          <div
            key={index}
            className={`mention-chip ${mention.type === 'tool' ? 'tool-mention-chip' : ''}`}
          >
            {mention.type === 'tab' ? (
              <>
                <img 
                  src={tabs.find(t => t.id.toString() === mention.id)?.favIconUrl} 
                  alt="" 
                  className="tab-favicon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="tab-title">{mention.display}</span>
              </>
            ) : (
              <span className="tool-name">{mention.display}</span>
            )}
            <button
              className="remove-btn"
              onClick={() => {
                const newValue = value.replace(
                  mention.type === 'tab' 
                    ? `@[${mention.display}](${mention.id})`
                    : `#[${mention.display}](${mention.id})`,
                  ''
                );
                onChange(newValue);
                if (inputRef.current) {
                  inputRef.current.textContent = newValue;
                }
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  }, [value, extractMentions, tabs, onChange]);

  return (
    <div className="tab-mention-input-container">
      <div className="mention-input-wrapper">
        {renderMentions()}
        <div
          ref={inputRef}
          className="mention-input"
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>
      
      {isDropdownOpen && (
        <div ref={dropdownRef} className="mention-dropdown">
          <div className="mention-search">
            <input
              type="text"
              placeholder="Search tabs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="tab-list">
            {isLoading ? (
              <div className="loading-tabs">
                <div className="loading-spinner" />
                <span>Loading tabs...</span>
              </div>
            ) : filteredTabs.length === 0 ? (
              <div className="no-results">
                <div className="icon">🔍</div>
                <span>No tabs found</span>
              </div>
            ) : (
              filteredTabs.map((tab, index) => (
                <div
                  key={tab.id}
                  className={`tab-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => insertMention(tab)}
                >
                  <div className="tab-favicon">
                    {tab.favIconUrl ? (
                      <img src={tab.favIconUrl} alt="" />
                    ) : (
                      <span>🌐</span>
                    )}
                  </div>
                  <div className="tab-info">
                    <div className="tab-title">{tab.title}</div>
                    <div className="tab-url">{tab.url}</div>
                  </div>
                  <div className="tab-status" />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TabMentionInput;