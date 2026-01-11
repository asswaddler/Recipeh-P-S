import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { CatalogueItem, MajorCategory } from '../../types';
import { Modal, SearchInput, Button } from '../common';
import './AddItemModal.css';

interface AddItemModalProps {
  onClose: () => void;
}

type ViewMode = 'browse' | 'custom';

export function AddItemModal({ onClose }: AddItemModalProps) {
  const { state, actions } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customQuantity, setCustomQuantity] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Flatten and filter catalogue items
  const filteredItems = useMemo(() => {
    const items: Array<CatalogueItem & { fullCategory: string }> = [];

    const majors: MajorCategory[] = ['Fresh', 'Pantry', 'Freezer'];

    majors.forEach(major => {
      const minorCategories = state.ingredientsCatalogue[major];
      Object.entries(minorCategories).forEach(([minor, catalogueItems]) => {
        catalogueItems.forEach(item => {
          items.push({
            ...item,
            fullCategory: `${major} - ${minor}`
          });
        });
      });
    });

    if (!searchQuery) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(
      item =>
        item.name.toLowerCase().includes(query) ||
        item.fullCategory.toLowerCase().includes(query)
    );
  }, [state.ingredientsCatalogue, searchQuery]);

  // Group by category for browsing
  const groupedItems = useMemo(() => {
    const groups: Record<string, Array<CatalogueItem & { fullCategory: string }>> = {};

    filteredItems.forEach(item => {
      if (!groups[item.fullCategory]) {
        groups[item.fullCategory] = [];
      }
      groups[item.fullCategory].push(item);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSelectCatalogueItem = (item: CatalogueItem) => {
    actions.addManualItem(item.name, undefined, item.id);
    onClose();
  };

  const handleAddCustomItem = () => {
    if (!customName.trim()) return;

    actions.addManualItem(customName.trim(), customQuantity.trim() || undefined);
    onClose();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add to Grocery List"
      size="large"
    >
      <div className="add-item-modal">
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'browse' ? 'active' : ''}`}
            onClick={() => setViewMode('browse')}
          >
            Browse Catalogue
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'custom' ? 'active' : ''}`}
            onClick={() => setViewMode('custom')}
          >
            Custom Item
          </button>
        </div>

        {viewMode === 'browse' ? (
          <>
            <div className="catalogue-search">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search ingredients..."
                autoFocus
              />
            </div>

            <div className="catalogue-list">
              {groupedItems.length === 0 ? (
                <div className="catalogue-empty">
                  {searchQuery ? 'No items found' : 'No catalogue items available'}
                </div>
              ) : (
                groupedItems.map(([category, items]) => (
                  <div key={category} className="catalogue-category">
                    <button
                      className="category-header"
                      onClick={() => toggleCategory(category)}
                    >
                      <span>{category}</span>
                      <span className="category-count">{items.length}</span>
                      <span className={`category-arrow ${expandedCategories.has(category) ? 'expanded' : ''}`}>
                        ▶
                      </span>
                    </button>
                    {(expandedCategories.has(category) || searchQuery) && (
                      <div className="category-items">
                        {items.map(item => (
                          <button
                            key={item.id}
                            className="catalogue-item"
                            onClick={() => handleSelectCatalogueItem(item)}
                          >
                            <span>{item.name}</span>
                            <span className="add-icon">+</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="custom-item-form">
            <div className="form-field">
              <label htmlFor="custom-name">Item Name</label>
              <input
                id="custom-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Oranges"
                autoFocus
              />
            </div>
            <div className="form-field">
              <label htmlFor="custom-quantity">Quantity (optional)</label>
              <input
                id="custom-quantity"
                type="text"
                value={customQuantity}
                onChange={(e) => setCustomQuantity(e.target.value)}
                placeholder="e.g., 3 or 500g"
              />
            </div>
            <Button
              variant="primary"
              fullWidth
              onClick={handleAddCustomItem}
              disabled={!customName.trim()}
            >
              Add to List
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
