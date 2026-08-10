package com.example.tms.service;

import com.example.tms.model.PagedResult;
import com.example.tms.model.Transaction;
import com.example.tms.model.TransactionFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionServiceTest {

    private static final TransactionFilter NO_FILTER = new TransactionFilter(null, null, null, null);

    private TransactionService service;
    private Path csvFile;

    @BeforeEach
    void setUp(@TempDir Path tempDir) {
        service = new TransactionService();
        csvFile = tempDir.resolve("transactions.csv");
        ReflectionTestUtils.setField(service, "csvFilePath", csvFile.toString());
    }

    private Transaction newTransaction(String date, String account, String name, double amount) {
        Transaction tx = new Transaction();
        tx.setTransactionDate(LocalDate.parse(date));
        tx.setAccountNumber(account);
        tx.setAccountHolderName(name);
        tx.setAmount(amount);
        return tx;
    }

    private void seedCsv(String... rows) throws IOException {
        List<String> lines = new ArrayList<>();
        lines.add("id,transactionDate,accountNumber,accountHolderName,amount,status");
        lines.addAll(List.of(rows));
        Files.write(csvFile, lines);
    }

    // --- addTransaction ---

    @Test
    void addTransaction_assignsIdAndRandomStatus() throws IOException {
        Transaction saved = service.addTransaction(newTransaction("2025-01-01", "111", "Alice", 100.0));

        assertThat(saved.getId()).isNotBlank();
        assertThat(saved.getStatus()).isIn("Pending", "Settled", "Failed");
    }

    @Test
    void addTransaction_roundTripsThroughGetAll() throws IOException {
        service.addTransaction(newTransaction("2025-01-01", "111", "Alice", 100.0));
        service.addTransaction(newTransaction("2025-01-02", "222", "Bob", 200.0));

        List<Transaction> all = service.getAllTransactions();

        assertThat(all).extracting(Transaction::getAccountHolderName).containsExactly("Alice", "Bob");
    }

    @Test
    void addTransaction_writesHeaderOnlyOnce() throws IOException {
        service.addTransaction(newTransaction("2025-01-01", "111", "Alice", 100.0));
        service.addTransaction(newTransaction("2025-01-02", "222", "Bob", 200.0));

        long headerLines = Files.lines(csvFile)
                .filter(line -> line.startsWith("id,transactionDate"))
                .count();

        assertThat(headerLines).isEqualTo(1);
    }

    // --- getTransactions: filtering ---

    @Test
    void getTransactions_filtersByStatus() throws IOException {
        seedCsv(
                "id-1,2025-01-01,111,Alice,100.00,Pending",
                "id-2,2025-01-02,222,Bob,200.00,Settled"
        );

        PagedResult<Transaction> result = service.getTransactions(
                new TransactionFilter("Settled", null, null, null), 0, 20);

        assertThat(result.getData()).extracting(Transaction::getId).containsExactly("id-2");
        assertThat(result.getTotalItems()).isEqualTo(1);
    }

    @Test
    void getTransactions_filtersByAccountNumber() throws IOException {
        seedCsv(
                "id-1,2025-01-01,111,Alice,100.00,Pending",
                "id-2,2025-01-02,222,Bob,200.00,Settled"
        );

        PagedResult<Transaction> result = service.getTransactions(
                new TransactionFilter(null, "222", null, null), 0, 20);

        assertThat(result.getData()).extracting(Transaction::getId).containsExactly("id-2");
    }

    @Test
    void getTransactions_filtersByDateRange() throws IOException {
        seedCsv(
                "id-1,2025-01-01,111,Alice,100.00,Pending",
                "id-2,2025-06-01,222,Bob,200.00,Settled",
                "id-3,2025-12-01,333,Carol,300.00,Failed"
        );

        PagedResult<Transaction> result = service.getTransactions(
                new TransactionFilter(null, null, LocalDate.parse("2025-02-01"), LocalDate.parse("2025-07-01")),
                0, 20);

        assertThat(result.getData()).extracting(Transaction::getId).containsExactly("id-2");
    }

    @Test
    void getTransactions_noFilter_returnsAll() throws IOException {
        seedCsv(
                "id-1,2025-01-01,111,Alice,100.00,Pending",
                "id-2,2025-01-02,222,Bob,200.00,Settled"
        );

        PagedResult<Transaction> result = service.getTransactions(NO_FILTER, 0, 20);

        assertThat(result.getTotalItems()).isEqualTo(2);
    }

    // --- getTransactions: pagination ---

    @Test
    void getTransactions_paginatesResults() throws IOException {
        seedCsv(
                "id-1,2025-01-01,111,Alice,100.00,Pending",
                "id-2,2025-01-02,222,Bob,200.00,Settled",
                "id-3,2025-01-03,333,Carol,300.00,Failed",
                "id-4,2025-01-04,444,Dan,400.00,Pending",
                "id-5,2025-01-05,555,Eve,500.00,Settled"
        );

        PagedResult<Transaction> page = service.getTransactions(NO_FILTER, 1, 2);

        assertThat(page.getData()).extracting(Transaction::getId).containsExactly("id-3", "id-4");
        assertThat(page.getTotalItems()).isEqualTo(5);
        assertThat(page.getTotalPages()).isEqualTo(3);
    }

    @Test
    void getTransactions_pageBeyondLastReturnsEmpty() throws IOException {
        seedCsv(
                "id-1,2025-01-01,111,Alice,100.00,Pending",
                "id-2,2025-01-02,222,Bob,200.00,Settled"
        );

        PagedResult<Transaction> page = service.getTransactions(NO_FILTER, 5, 2);

        assertThat(page.getData()).isEmpty();
        assertThat(page.getTotalItems()).isEqualTo(2);
    }

    // --- updateTransaction ---

    @Test
    void updateTransaction_preservesIdAndStatus() throws IOException {
        seedCsv("id-1,2025-01-01,111,Alice,100.00,Settled");

        Transaction incoming = newTransaction("2025-02-01", "999", "Alice Updated", 999.0);
        Transaction updated = service.updateTransaction("id-1", incoming);

        assertThat(updated.getId()).isEqualTo("id-1");
        assertThat(updated.getStatus()).isEqualTo("Settled");
        assertThat(updated.getAccountHolderName()).isEqualTo("Alice Updated");
    }

    @Test
    void updateTransaction_unknownId_returnsNull() throws IOException {
        seedCsv("id-1,2025-01-01,111,Alice,100.00,Settled");

        Transaction result = service.updateTransaction("missing", newTransaction("2025-02-01", "999", "X", 1.0));

        assertThat(result).isNull();
    }

    // --- deleteTransaction ---

    @Test
    void deleteTransaction_removesMatchingRow() throws IOException {
        seedCsv(
                "id-1,2025-01-01,111,Alice,100.00,Settled",
                "id-2,2025-01-02,222,Bob,200.00,Pending"
        );

        boolean deleted = service.deleteTransaction("id-1");

        assertThat(deleted).isTrue();
        assertThat(service.getAllTransactions()).extracting(Transaction::getId).containsExactly("id-2");
    }

    @Test
    void deleteTransaction_unknownId_returnsFalse() throws IOException {
        seedCsv("id-1,2025-01-01,111,Alice,100.00,Settled");

        boolean deleted = service.deleteTransaction("missing");

        assertThat(deleted).isFalse();
    }
}
