package com.example.tms.model;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PagedResultTest {

    @Test
    void totalPages_exactDivision() {
        PagedResult<String> result = new PagedResult<>(List.of("a", "b"), 0, 5, 10);

        assertThat(result.getTotalPages()).isEqualTo(2);
    }

    @Test
    void totalPages_roundsUpForRemainder() {
        PagedResult<String> result = new PagedResult<>(List.of("a"), 0, 5, 11);

        assertThat(result.getTotalPages()).isEqualTo(3);
    }

    @Test
    void totalPages_zeroWhenNoItems() {
        PagedResult<String> result = new PagedResult<>(List.of(), 0, 5, 0);

        assertThat(result.getTotalPages()).isEqualTo(0);
    }

    @Test
    void totalPages_zeroWhenSizeIsZero() {
        PagedResult<String> result = new PagedResult<>(List.of(), 0, 0, 10);

        assertThat(result.getTotalPages()).isEqualTo(0);
    }

    @Test
    void gettersReturnConstructorValues() {
        List<String> data = List.of("a", "b", "c");
        PagedResult<String> result = new PagedResult<>(data, 2, 3, 42);

        assertThat(result.getData()).isEqualTo(data);
        assertThat(result.getPage()).isEqualTo(2);
        assertThat(result.getSize()).isEqualTo(3);
        assertThat(result.getTotalItems()).isEqualTo(42);
    }
}
