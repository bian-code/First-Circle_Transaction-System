package com.example.tms.controller;

import com.example.tms.model.PagedResult;
import com.example.tms.model.Transaction;
import com.example.tms.service.TransactionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TransactionController.class)
class TransactionControllerTest {

    private static final String VALID_BODY = """
            {"transactionDate":"2025-01-01","accountNumber":"111222333444","accountHolderName":"Alice","amount":100.0}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TransactionService transactionService;

    private Transaction sampleTransaction() {
        return new Transaction("id-1", LocalDate.parse("2025-01-01"), "111222333444", "Alice", 100.0, "Settled");
    }

    private String bodyWithAccountNumber(String accountNumber) {
        return """
                {"transactionDate":"2025-01-01","accountNumber":"%s","accountHolderName":"Alice","amount":100.0}
                """.formatted(accountNumber);
    }

    // --- GET /api/transactions ---

    @Test
    void getTransactions_returns200WithPagedResult() throws Exception {
        PagedResult<Transaction> paged = new PagedResult<>(List.of(sampleTransaction()), 0, 20, 1);
        when(transactionService.getTransactions(any(), anyInt(), anyInt())).thenReturn(paged);

        mockMvc.perform(get("/api/transactions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value("id-1"))
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void getTransactions_negativePage_returns400() throws Exception {
        mockMvc.perform(get("/api/transactions").param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void getTransactions_sizeTooLarge_returns400() throws Exception {
        mockMvc.perform(get("/api/transactions").param("size", "101"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getTransactions_sizeTooSmall_returns400() throws Exception {
        mockMvc.perform(get("/api/transactions").param("size", "0"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getTransactions_invalidStatus_returns400() throws Exception {
        mockMvc.perform(get("/api/transactions").param("status", "Bogus"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getTransactions_fromAfterTo_returns400() throws Exception {
        mockMvc.perform(get("/api/transactions").param("from", "2026-01-01").param("to", "2025-01-01"))
                .andExpect(status().isBadRequest());
    }

    // --- POST /api/transactions ---

    @Test
    void createTransaction_validBody_returns201() throws Exception {
        when(transactionService.addTransaction(any())).thenReturn(sampleTransaction());

        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("id-1"));
    }

    @Test
    void createTransaction_missingFields_returns400() throws Exception {
        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isArray());
    }

    @Test
    void createTransaction_malformedJson_returns400() throws Exception {
        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("not-json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createTransaction_accountNumberTooShort_returns400() throws Exception {
        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyWithAccountNumber("12345")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("accountNumber: Account number must be exactly 12 digits (numbers only)"));
    }

    @Test
    void createTransaction_accountNumberWithDashes_returns400() throws Exception {
        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyWithAccountNumber("1234-5678-9012")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createTransaction_accountNumberWithLetters_returns400() throws Exception {
        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyWithAccountNumber("11122233344A")))
                .andExpect(status().isBadRequest());
    }

    // --- PUT /api/transactions/{id} ---

    @Test
    void updateTransaction_validBody_returns200() throws Exception {
        when(transactionService.updateTransaction(eq("id-1"), any())).thenReturn(sampleTransaction());

        mockMvc.perform(put("/api/transactions/id-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("id-1"));
    }

    @Test
    void updateTransaction_unknownId_returns404() throws Exception {
        when(transactionService.updateTransaction(eq("missing"), any())).thenReturn(null);

        mockMvc.perform(put("/api/transactions/missing")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateTransaction_invalidBody_returns400() throws Exception {
        mockMvc.perform(put("/api/transactions/id-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateTransaction_invalidAccountNumber_returns400() throws Exception {
        mockMvc.perform(put("/api/transactions/id-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyWithAccountNumber("not-a-number")))
                .andExpect(status().isBadRequest());
    }

    // --- DELETE /api/transactions/{id} ---

    @Test
    void deleteTransaction_found_returns204() throws Exception {
        when(transactionService.deleteTransaction("id-1")).thenReturn(true);

        mockMvc.perform(delete("/api/transactions/id-1"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteTransaction_notFound_returns404() throws Exception {
        when(transactionService.deleteTransaction("missing")).thenReturn(false);

        mockMvc.perform(delete("/api/transactions/missing"))
                .andExpect(status().isNotFound());
    }
}
