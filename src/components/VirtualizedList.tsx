/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * High-Performance Virtualized Table & List Renderer
 * Keeps DOM element count constant (~15-25 visible items) regardless of dataset size,
 * ensuring 60fps silky smooth scrolling and near-instant initial render times.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";

export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight?: number | string;
  overscan?: number;
  className?: string;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  emptyState?: React.ReactNode;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight = 500,
  overscan = 4,
  className = "",
  renderItem,
  keyExtractor = (_item, idx) => idx,
  emptyState
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    typeof containerHeight === "number" ? containerHeight : 500
  );

  const totalCount = items.length;
  const totalHeight = totalCount * itemHeight;

  // Observe container size dynamically
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Compute visible range
  const { startIndex, endIndex, topPadding, bottomPadding } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2 * overscan;
    const end = Math.min(totalCount, start + visibleCount);

    const top = start * itemHeight;
    const bottom = Math.max(0, (totalCount - end) * itemHeight);

    return {
      startIndex: start,
      endIndex: end,
      topPadding: top,
      bottomPadding: bottom,
    };
  }, [scrollTop, itemHeight, viewportHeight, totalCount, overscan]);

  if (totalCount === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-y-auto relative ${className}`}
      style={{
        height: typeof containerHeight === "number" ? `${containerHeight}px` : containerHeight,
        maxHeight: "100%",
        willChange: "scroll-position",
      }}
    >
      <div style={{ height: `${totalHeight}px`, width: "100%", position: "relative" }}>
        <div style={{ transform: `translateY(${topPadding}px)`, width: "100%" }}>
          {visibleItems.map((item, localIdx) => {
            const actualIndex = startIndex + localIdx;
            const key = keyExtractor(item, actualIndex);
            return (
              <div
                key={key}
                style={{
                  minHeight: `${itemHeight}px`,
                  width: "100%",
                }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Custom hook for virtualizing custom tables or grids
 */
export function useVirtualScroll({
  totalItems,
  itemHeight,
  viewportHeight,
  scrollTop,
  overscan = 3,
}: {
  totalItems: number;
  itemHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
}) {
  return useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2 * overscan;
    const endIndex = Math.min(totalItems, startIndex + visibleCount);

    return {
      startIndex,
      endIndex,
      topPadding: startIndex * itemHeight,
      bottomPadding: Math.max(0, (totalItems - endIndex) * itemHeight),
      totalHeight: totalItems * itemHeight,
    };
  }, [totalItems, itemHeight, viewportHeight, scrollTop, overscan]);
}
