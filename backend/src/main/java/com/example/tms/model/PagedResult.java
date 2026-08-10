package com.example.tms.model;

import java.util.List;

/**
 * Generic pagination wrapper returned by GET /api/transactions.
 *
 * Example response body for page=0, size=10 with 47 total records:
 * {
 *   "data":       [ { ... }, { ... }, ... ],  // up to 'size' items
 *   "page":       0,
 *   "size":       10,
 *   "totalItems": 47,
 *   "totalPages": 5
 * }
 */
public class PagedResult<T> {

    private final List<T> data;
    private final int page;
    private final int size;
    private final long totalItems;
    private final int totalPages;

    public PagedResult(List<T> data, int page, int size, long totalItems) {
        this.data = data;
        this.page = page;
        this.size = size;
        this.totalItems = totalItems;
        this.totalPages = size == 0 ? 0 : (int) Math.ceil((double) totalItems / size);
    }

    public List<T> getData() {
        return data;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }

    public long getTotalItems() {
        return totalItems;
    }

    public int getTotalPages() {
        return totalPages;
    }
}
