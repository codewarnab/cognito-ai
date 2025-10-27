/**
 * Memory Sidebar Component
 * Right-sliding sidebar for memory management
 */

import React, { useState, useEffect } from "react";
import { X, Brain, Pin, Trash2, Check, X as XIcon, Lightbulb } from "lucide-react";
import { FoldersIcon } from "./FoldersIcon";
import * as memoryStore from "../memory/store";
import type { StoredMemory } from "../memory/types";
import { createLogger } from "../logger";

const log = createLogger("MemorySidebar");

type FilterTab = "all" | "fact" | "behavior";

interface MemorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MemorySidebar({ isOpen, onClose }: MemorySidebarProps) {
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
    <>
      {/* Backdrop */}
      <div className="memory-sidebar-backdrop" onClick={onClose} />
      
      {/* Sidebar */}
      <div className="memory-sidebar">
            {/* Header */}
            <div className="memory-sidebar-header">
              <div className="memory-sidebar-header-content">
                <FoldersIcon size={18} className="memory-sidebar-icon" />
                <h2>Memory</h2>
              </div>
              <button 
                onClick={onClose} 
                className="memory-sidebar-close"
                title="Close memory management"
              >
                <X size={20} />
              </button>
            </div>

            {/* Settings */}
            <div className="memory-sidebar-settings">
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
            <div className="memory-sidebar-search">
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="memory-search-input"
              />
            </div>

            {/* Filter Tabs */}
            <div className="memory-sidebar-tabs">
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
            <div className="memory-sidebar-content">
              {loading ? (
                <div className="memory-sidebar-loading">Loading memories...</div>
              ) : filteredMemories.length === 0 ? (
                <div className="memory-sidebar-empty">
                  {searchQuery ? (
                    <p>No memories match your search.</p>
                  ) : (
                    <>
                      <div className="memory-empty-icon">
                        <Brain size={48} />
                      </div>
                      <p>No memories saved yet.</p>
                      <p className="memory-empty-subtitle">
                        I'll suggest saving useful information as we work together.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="memory-sidebar-list">
                  {filteredMemories.map((memory) => (
                    <div key={memory.id} className="memory-item">
                      <div className="memory-item-header">
                        <div className="memory-item-key">
                          {memory.pinned && <Pin size={12} className="memory-pin" />}
                          {memory.key}
                        </div>
                        <button
                          className="memory-item-delete"
                          onClick={() => handleDelete(memory.id)}
                          aria-label="Delete"
                          title="Delete memory"
                        >
                          <Trash2 size={14} />
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
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="memory-sidebar-footer">
              <p>
                <Lightbulb size={14} className="memory-footer-icon" />
                Ask me to save, list, or delete memories anytime!
              </p>
            </div>
          </div>
        </>
      );
}
