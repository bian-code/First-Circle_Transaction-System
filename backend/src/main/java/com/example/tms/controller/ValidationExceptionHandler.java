package com.example.tms.controller;

import com.example.tms.model.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.List;

/**
 * Translates validation and deserialization failures into structured
 * ErrorResponse bodies with the correct HTTP status code.
 *
 * Every error path — whether from @Valid, Jackson, or manual checks in
 * the controller — now produces the same JSON shape:
 * {
 *   "status": <http-status-code>,
 *   "errors": [ "<message>", ... ]
 * }
 */
@ControllerAdvice
public class ValidationExceptionHandler {

    /**
     * Bean Validation failure (@Valid on @RequestBody).
     * Collects every violated constraint into the errors list.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(
            MethodArgumentNotValidException ex) {

        List<String> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .sorted()
                .toList();

        return ResponseEntity.badRequest()
                .body(ErrorResponse.of(HttpStatus.BAD_REQUEST.value(), errors));
    }

    /**
     * Jackson deserialization failure — malformed JSON, wrong field type,
     * or a date string that does not match yyyy-MM-dd.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableMessage(
            HttpMessageNotReadableException ex) {

        Throwable cause = ex.getMostSpecificCause();
        String detail = cause.getMessage();

        // Trim verbose Jackson class-path noise that appears after the first newline.
        if (detail != null && detail.contains("\n")) {
            detail = detail.substring(0, detail.indexOf('\n')).trim();
        }

        String message = "Invalid request body" + (detail != null ? ": " + detail : "");
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of(HttpStatus.BAD_REQUEST.value(), message));
    }
}
