/**
 * Memory Panel Component
 * UI for viewing, filtering, and managing stored memories
 */

import React, { useState, useEffect } from "react";
import * as memoryStore from "../memory/store";
import type { StoredMemory } from "../memory/types";
import { createLogger } from "../logger";

const log = createLogger("MemoryPanel");

type FilterTab = "all" | "fact" | "behavior";

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MemoryPanel({ isOpen, onClose }: MemoryPanelProps) {
  const [memories, setMemories] = useState<StoredMemory[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveSuggestionsEnabled, setSaveSuggestionsEnabled] = useState(true);

  // Load memories
  const loadMemories = async () => {
    setLoading(true);
    try {
      const allMemories = await memoryStore.listMemories();
      setMemories(allMemories);
    } catch (error) {
      log.error("Failed to load memories", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen]);

  // Handle delete
  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this memory?")) {
      try {
        await memoryStore.deleteMemory(id);
        await loadMemories();
      } catch (error) {
        log.error("Failed to delete memory", error);
        alert("Failed to delete memory");
      }
    }
  };

  // Filter memories
  const filteredMemories = memories.filter((memory) => {
    // Category filter
    if (filter !== "all" && memory.category !== filter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const keyMatch = memory.key.toLowerCase().includes(query);
      const valueMatch = String(memory.value).toLowerCase().includes(query);
      return keyMatch || valueMatch;
    }

    return true;
  });

  // Count by category
  const factCount = memories.filter((m) => m.category === "fact").length;
  const behaviorCount = memories.filter((m) => m.category === "behavior").length;

  if (!isOpen) return null;

  return (
    <div className="memory-panel-overlay" onClick={onClose}>
      <div className="memory-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="memory-panel-header">
          <h2>💾 Memory</h2>
          <button className="memory-panel-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Settings */}
        <div className="memory-panel-settings">
          <label className="memory-toggle-label">
            <input
              type="checkbox"
              checked={saveSuggestionsEnabled}
              onChange={(e) => setSaveSuggestionsEnabled(e.target.checked)}
            />
            <span>Offer save suggestions</span>
          </label>
        </div>

        {/* Search */}
        <div className="memory-panel-search">
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="memory-search-input"
          />
        </div>

        {/* Filter Tabs */}
        <div className="memory-panel-tabs">
          <button
            className={`memory-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({memories.length})
          </button>
          <button
            className={`memory-tab ${filter === "fact" ? "active" : ""}`}
            onClick={() => setFilter("fact")}
          >
            Facts ({factCount})
          </button>
          <button
            className={`memory-tab ${filter === "behavior" ? "active" : ""}`}
            onClick={() => setFilter("behavior")}
          >
            Behavioral ({behaviorCount})
          </button>
        </div>

        {/* Memory List */}
        <div className="memory-panel-list">
          {loading ? (
            <div className="memory-panel-loading">Loading memories...</div>
          ) : filteredMemories.length === 0 ? (
            <div className="memory-panel-empty">
              {searchQuery ? (
                <p>No memories match your search.</p>
              ) : (
                <>
                  <div className="memory-empty-icon">🧠</div>
                  <p>No memories saved yet.</p>
                  <p className="memory-empty-subtitle">
                    I'll suggest saving useful information as we work together.
                  </p>
                </>
              )}
            </div>
          ) : (
            filteredMemories.map((memory) => (
              <div key={memory.id} className="memory-item">
                <div className="memory-item-header">
                  <div className="memory-item-key">
                    {memory.pinned && <span className="memory-pin">📌</span>}
                    {memory.key}
                  </div>
                  <button
                    className="memory-item-delete"
                    onClick={() => handleDelete(memory.id)}
                    aria-label="Delete"
                    title="Delete memory"
                  >
                    🗑️
                  </button>
                </div>
                <div className="memory-item-value">{String(memory.value)}</div>
                <div className="memory-item-meta">
                  <span className={`memory-category-badge ${memory.category}`}>
                    {memory.category}
                  </span>
                  <span className="memory-source">Source: {memory.source}</span>
                  <span className="memory-date">
                    {new Date(memory.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="memory-panel-footer">
          <p>💡 Ask me to save, list, or delete memories anytime!</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Consent Prompt Component
 * Non-blocking chip for asking user consent to save a memory
 */
interface ConsentPromptProps {
  memoryKey: string;
  memoryValue: string;
  category: "fact" | "behavior";
  onYes: () => void;
  onNo: () => void;
  onNeverAsk?: () => void;
}

export function ConsentPrompt({
  memoryKey,
  memoryValue,
  category,
  onYes,
  onNo,
  onNeverAsk,
}: ConsentPromptProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="consent-prompt">
      <div className="consent-prompt-icon">💾</div>
      <div className="consent-prompt-content">
        <div className="consent-prompt-title">Remember this?</div>
        <div className="consent-prompt-text">
          <strong>{memoryKey}:</strong> {String(memoryValue)}
        </div>
        <div className="consent-prompt-category">Category: {category}</div>
      </div>
      <div className="consent-prompt-actions">
        <button className="consent-btn consent-btn-yes" onClick={onYes}>
          ✓ Yes
        </button>
        <button className="consent-btn consent-btn-no" onClick={onNo}>
          ✕ No
        </button>
        {onNeverAsk && (
          <button
            className="consent-btn consent-btn-advanced"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="Advanced options"
          >
            ⋮
          </button>
        )}
      </div>
      {showAdvanced && onNeverAsk && (
        <div className="consent-prompt-advanced">
          <button className="consent-btn-never" onClick={onNeverAsk}>
            Don't ask again for this
          </button>
        </div>
      )}
    </div>
  );
}

