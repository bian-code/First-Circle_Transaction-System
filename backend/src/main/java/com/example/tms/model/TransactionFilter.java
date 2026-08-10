package com.example.tms.model;

import java.time.LocalDate;

/**
 * Holds all optional filter criteria for GET /api/transactions.
 * Every field is nullable — a null value means "no constraint on this field".
 *
 * @param status        exact match on status (case-insensitive), e.g. "Pending"
 * @param accountNumber exact match on accountNumber, e.g. "1234-5678-9012"
 * @param from          inclusive lower bound on transactionDate
 * @param to            inclusive upper bound on transactionDate
 */
public record TransactionFilter(
        String status,
        String accountNumber,
        LocalDate from,
        LocalDate to
) {
    /** Returns true when no filter criteria are set — avoids unnecessary stream overhead. */
    public boolean isEmpty() {
        return status == null && accountNumber == null && from == null && to == null;
    }

    /** Returns true if the given transaction satisfies every non-null criterion. */
    public boolean matches(Transaction tx) {
        if (status != null && !status.equalsIgnoreCase(tx.getStatus())) {
            return false;
        }
        if (accountNumber != null && !accountNumber.equals(tx.getAccountNumber())) {
            return false;
        }
        if (from != null && tx.getTransactionDate().isBefore(from)) {
            return false;
        }
        if (to != null && tx.getTransactionDate().isAfter(to)) {
            return false;
        }
        return true;
    }
}
