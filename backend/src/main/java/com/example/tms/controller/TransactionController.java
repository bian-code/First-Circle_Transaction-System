package com.example.tms.controller;

import com.example.tms.model.ErrorResponse;
import com.example.tms.model.PagedResult;
import com.example.tms.model.Transaction;
import com.example.tms.model.TransactionFilter;
import com.example.tms.service.TransactionService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.Set;

@RestController
@RequestMapping("/api/transactions")
@CrossOrigin(origins = "http://localhost:5173") // Vite dev server default port
public class TransactionController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> VALID_STATUSES = Set.of("Pending", "Settled", "Failed");

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    /**
     * GET /api/transactions
     *
     * All query parameters are optional and combinable.
     *
     * Pagination:
     *   page          — zero-based page index (default 0)
     *   size          — records per page, 1–100 (default 20)
     *
     * Filters:
     *   status        — exact match, one of: Pending, Settled, Failed
     *   accountNumber — exact match, e.g. 1234-5678-9012
     *   from          — inclusive start date, yyyy-MM-dd
     *   to            — inclusive end date,   yyyy-MM-dd
     *
     * totalItems in the response always reflects the filtered count.
     *
     * Example:
     *   GET /api/transactions?status=Pending&from=2025-01-01&to=2025-06-30&page=0&size=10
     */
    @GetMapping
    public ResponseEntity<?> getAllTransactions(
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "20")  int size,
            @RequestParam(required = false)     String status,
            @RequestParam(required = false)     String accountNumber,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        // --- validate pagination params ---
        if (page < 0) {
            return ResponseEntity.badRequest()
                    .body(ErrorResponse.of(400, "page must be >= 0"));
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            return ResponseEntity.badRequest()
                    .body(ErrorResponse.of(400, "size must be between 1 and " + MAX_PAGE_SIZE));
        }

        // --- validate filter params ---
        if (status != null && !VALID_STATUSES.contains(status)) {
            return ResponseEntity.badRequest()
                    .body(ErrorResponse.of(400, "status must be one of: " + VALID_STATUSES));
        }
        if (from != null && to != null && from.isAfter(to)) {
            return ResponseEntity.badRequest()
                    .body(ErrorResponse.of(400, "'from' date must not be after 'to' date"));
        }

        TransactionFilter filter = new TransactionFilter(status, accountNumber, from, to);

        try {
            PagedResult<Transaction> result = transactionService.getTransactions(filter, page, size);
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorResponse.of(500, "Error reading transactions: " + e.getMessage()));
        }
    }

    /**
     * POST /api/transactions
     * Accepts a transaction payload, assigns a random status, persists to CSV,
     * and returns the saved transaction with status.
     */
    @PostMapping
    public ResponseEntity<?> createTransaction(@Valid @RequestBody Transaction transaction) {
        try {
            Transaction saved = transactionService.addTransaction(transaction);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorResponse.of(500, "Error saving transaction: " + e.getMessage()));
        }
    }

    /**
     * PUT /api/transactions/{id}
     * Updates the editable fields of an existing transaction.
     * The id and status are always preserved from the stored record — status
     * is assigned randomly at creation and cannot be changed via this endpoint.
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateTransaction(
            @PathVariable String id,
            @Valid @RequestBody Transaction transaction) {
        try {
            Transaction updated = transactionService.updateTransaction(id, transaction);
            if (updated == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ErrorResponse.of(404, "Transaction not found: " + id));
            }
            return ResponseEntity.ok(updated);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorResponse.of(500, "Error updating transaction: " + e.getMessage()));
        }
    }

    /**
     * DELETE /api/transactions/{id}
     * Removes the transaction with the given id. Returns 204 No Content on success.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTransaction(@PathVariable String id) {
        try {
            boolean deleted = transactionService.deleteTransaction(id);
            if (!deleted) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ErrorResponse.of(404, "Transaction not found: " + id));
            }
            return ResponseEntity.noContent().build();
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ErrorResponse.of(500, "Error deleting transaction: " + e.getMessage()));
        }
    }
}
