package com.example.tms.service;

import com.example.tms.model.PagedResult;
import com.example.tms.model.Transaction;
import com.example.tms.model.TransactionFilter;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Service
public class TransactionService {

    private static final String[] STATUSES = {"Pending", "Settled", "Failed"};
    private static final String[] CSV_HEADERS = {
            "id", "transactionDate", "accountNumber", "accountHolderName", "amount", "status"
    };

    private final Random random = new Random();
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    @Value("${tms.csv.file-path}")
    private String csvFilePath;

    /**
     * Returns a single page of transactions, optionally narrowed by filter criteria.
     * Filtering is applied first; pagination is applied to the filtered set so that
     * totalItems always reflects the number of matching records, not the raw file size.
     *
     * @param filter criteria to narrow results — any null field is ignored
     * @param page   zero-based page index
     * @param size   maximum number of records per page
     */
    public PagedResult<Transaction> getTransactions(TransactionFilter filter, int page, int size)
            throws IOException {

        List<Transaction> all = getAllTransactions();

        // Apply filters only when at least one criterion is present.
        List<Transaction> filtered = filter.isEmpty()
                ? all
                : all.stream().filter(filter::matches).toList();

        long totalItems = filtered.size();

        int fromIndex = page * size;
        if (fromIndex >= totalItems) {
            // Page is beyond the last record — return empty data with correct totals.
            return new PagedResult<>(List.of(), page, size, totalItems);
        }

        int toIndex = (int) Math.min((long) fromIndex + size, totalItems);
        List<Transaction> pageData = filtered.subList(fromIndex, toIndex);

        return new PagedResult<>(pageData, page, size, totalItems);
    }

    /**
     * Reads all transactions from the CSV file and returns them as a list.
     * A read lock is held for the duration so that a concurrent write cannot
     * interleave with the file read.
     */
    public List<Transaction> getAllTransactions() throws IOException {
        lock.readLock().lock();
        try {
            return readAll();
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Deletes the transaction with the given id.
     * Reads all rows, removes the matching one, then rewrites the file.
     *
     * @return true if a row was removed, false if no row with that id existed
     */
    public boolean deleteTransaction(String id) throws IOException {
        lock.writeLock().lock();
        try {
            List<Transaction> all = readAll();
            List<Transaction> updated = all.stream()
                    .filter(tx -> !tx.getId().equals(id))
                    .toList();

            if (updated.size() == all.size()) {
                return false; // nothing was removed
            }

            writeAll(updated);
            return true;
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Replaces the transaction with the given id with the supplied data.
     * The id and status fields from the stored record are preserved —
     * the caller may not change them via this method.
     *
     * @return the updated Transaction, or null if no row with that id existed
     */
    public Transaction updateTransaction(String id, Transaction incoming) throws IOException {
        lock.writeLock().lock();
        try {
            List<Transaction> all = readAll();
            boolean found = false;
            List<Transaction> updated = new ArrayList<>(all.size());

            for (Transaction tx : all) {
                if (tx.getId().equals(id)) {
                    // Preserve id and status — status is assigned at creation and is immutable
                    incoming.setId(tx.getId());
                    incoming.setStatus(tx.getStatus());
                    updated.add(incoming);
                    found = true;
                } else {
                    updated.add(tx);
                }
            }

            if (!found) {
                return null;
            }

            writeAll(updated);
            return incoming;
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Assigns a random status to the incoming transaction, appends it to the CSV,
     * and returns the persisted transaction (with status set).
     * A write lock is held for the duration so that only one writer can access
     * the file at a time, preventing interleaved appends from concurrent requests.
     */
    public Transaction addTransaction(Transaction transaction) throws IOException {
        // Assign status and id before acquiring the lock — pure CPU work,
        // no need to hold the lock during this step.
        String assignedStatus = STATUSES[random.nextInt(STATUSES.length)];
        transaction.setStatus(assignedStatus);
        transaction.setId(UUID.randomUUID().toString());

        lock.writeLock().lock();
        try {
            Path path = Paths.get(csvFilePath);

            // Create parent directories if they don't exist
            if (path.getParent() != null) {
                Files.createDirectories(path.getParent());
            }

            boolean fileExists = Files.exists(path);

            // Append mode: open file for writing, append if it already exists
            try (Writer writer = new FileWriter(path.toFile(), true);
                 CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT)) {

                // Write header row only if the file is being created for the first time
                if (!fileExists) {
                    printer.printRecord((Object[]) CSV_HEADERS);
                }

                printer.printRecord(
                        transaction.getId(),
                        transaction.getTransactionDate().toString(), // ISO yyyy-MM-dd
                        transaction.getAccountNumber(),
                        transaction.getAccountHolderName(),
                        String.format("%.2f", transaction.getAmount()),
                        transaction.getStatus()
                );

                printer.flush();
            }
        } finally {
            lock.writeLock().unlock();
        }

        return transaction;
    }

    // -------------------------------------------------------------------------
    // Private helpers — must only be called while holding the appropriate lock
    // -------------------------------------------------------------------------

    /**
     * Reads all rows from the CSV without acquiring any lock.
     * Callers are responsible for holding at least a read lock.
     */
    private List<Transaction> readAll() throws IOException {
        List<Transaction> transactions = new ArrayList<>();
        Path path = Paths.get(csvFilePath);

        if (!Files.exists(path)) {
            return transactions;
        }

        try (Reader reader = Files.newBufferedReader(path);
             CSVParser parser = CSVFormat.DEFAULT
                     .builder()
                     .setHeader(CSV_HEADERS)
                     .setSkipHeaderRecord(true)
                     .setIgnoreEmptyLines(true)
                     .setTrim(true)
                     .build()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                transactions.add(new Transaction(
                        record.get("id"),
                        LocalDate.parse(record.get("transactionDate")),
                        record.get("accountNumber"),
                        record.get("accountHolderName"),
                        Double.parseDouble(record.get("amount")),
                        record.get("status")
                ));
            }
        }

        return transactions;
    }

    /**
     * Overwrites the CSV file with the given list of transactions.
     * Callers are responsible for holding the write lock.
     */
    private void writeAll(List<Transaction> transactions) throws IOException {
        Path path = Paths.get(csvFilePath);

        if (path.getParent() != null) {
            Files.createDirectories(path.getParent());
        }

        try (Writer writer = new FileWriter(path.toFile(), false); // overwrite, not append
             CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT)) {

            printer.printRecord((Object[]) CSV_HEADERS);

            for (Transaction tx : transactions) {
                printer.printRecord(
                        tx.getId(),
                        tx.getTransactionDate().toString(),
                        tx.getAccountNumber(),
                        tx.getAccountHolderName(),
                        String.format("%.2f", tx.getAmount()),
                        tx.getStatus()
                );
            }

            printer.flush();
        }
    }
}
