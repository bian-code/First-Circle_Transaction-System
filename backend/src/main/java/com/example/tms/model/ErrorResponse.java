package com.example.tms.model;

import java.util.List;

/**
 * Uniform error body returned for every non-2xx response.
 *
 * Single-message example (400 from param validation):
 * {
 *   "status": 400,
 *   "errors": ["page must be >= 0"]
 * }
 *
 * Multi-message example (422 from Bean Validation):
 * {
 *   "status": 400,
 *   "errors": [
 *     "accountHolderName: Account holder name is required",
 *     "amount: Amount must be greater than 0"
 *   ]
 * }
 */
public record ErrorResponse(int status, List<String> errors) {

    /** Convenience factory for a single message. */
    public static ErrorResponse of(int status, String message) {
        return new ErrorResponse(status, List.of(message));
    }

    /** Convenience factory for multiple messages. */
    public static ErrorResponse of(int status, List<String> messages) {
        return new ErrorResponse(status, messages);
    }
}
