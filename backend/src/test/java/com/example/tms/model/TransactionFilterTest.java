package com.example.tms.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionFilterTest {

    private Transaction tx(String date, String account, String status) {
        return new Transaction("id-1", LocalDate.parse(date), account, "Name", 10.0, status);
    }

    @Test
    void isEmpty_trueWhenAllFieldsNull() {
        assertThat(new TransactionFilter(null, null, null, null).isEmpty()).isTrue();
    }

    @Test
    void isEmpty_falseWhenAnyFieldSet() {
        assertThat(new TransactionFilter("Pending", null, null, null).isEmpty()).isFalse();
    }

    @Test
    void matches_statusIsCaseInsensitive() {
        TransactionFilter filter = new TransactionFilter("pending", null, null, null);

        assertThat(filter.matches(tx("2025-01-01", "111", "Pending"))).isTrue();
    }

    @Test
    void matches_rejectsDifferentStatus() {
        TransactionFilter filter = new TransactionFilter("Settled", null, null, null);

        assertThat(filter.matches(tx("2025-01-01", "111", "Pending"))).isFalse();
    }

    @Test
    void matches_accountNumberExactMatch() {
        TransactionFilter filter = new TransactionFilter(null, "111", null, null);

        assertThat(filter.matches(tx("2025-01-01", "111", "Pending"))).isTrue();
        assertThat(filter.matches(tx("2025-01-01", "222", "Pending"))).isFalse();
    }

    @Test
    void matches_dateRangeInclusiveBounds() {
        TransactionFilter filter = new TransactionFilter(
                null, null, LocalDate.parse("2025-01-01"), LocalDate.parse("2025-01-31"));

        assertThat(filter.matches(tx("2025-01-01", "111", "Pending"))).isTrue();
        assertThat(filter.matches(tx("2025-01-31", "111", "Pending"))).isTrue();
        assertThat(filter.matches(tx("2024-12-31", "111", "Pending"))).isFalse();
        assertThat(filter.matches(tx("2025-02-01", "111", "Pending"))).isFalse();
    }

    @Test
    void matches_allCriteriaCombined() {
        TransactionFilter filter = new TransactionFilter(
                "Pending", "111", LocalDate.parse("2025-01-01"), LocalDate.parse("2025-01-31"));

        assertThat(filter.matches(tx("2025-01-15", "111", "Pending"))).isTrue();
        assertThat(filter.matches(tx("2025-01-15", "111", "Settled"))).isFalse();
        assertThat(filter.matches(tx("2025-01-15", "222", "Pending"))).isFalse();
    }
}
