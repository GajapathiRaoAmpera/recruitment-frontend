// AC-5: every coding question / test set-up error gets a clear message; 422 details map onto the form fields.
import { expect, it } from "vitest";
import { ApiError } from "@/api/client";
import { codingErrorMessage, fieldErrors } from "./messages";

it.each([
  ["QUESTION_IN_USE", /already answered this question, so its test cases can't change/],
  ["QUESTION_NOT_FOUND", /question wasn't found/],
  ["QUESTIONS_NOT_FOUND", /don't exist any more.*Remove the flagged ones/],
  ["QUESTIONS_NOT_APPROVED", /aren't approved yet/],
  ["QUESTIONS_INCOMPLETE", /exactly 3 sample and 15 hidden/],
  ["TEST_IN_USE", /already started this test/],
  ["ROUND_NOT_FOUND", /round wasn't found/],
  ["ROUND_HAS_NO_TEST", /no test to set up/],
  ["TEST_NOT_FOUND", /isn't set up yet/],
  ["VALIDATION_ERROR", /highlighted fields/],
])("%s", (code, text) => {
  expect(codingErrorMessage(new ApiError(409, code, "raw"))).toMatch(text);
});

it("falls back to the server's message", () => {
  expect(codingErrorMessage(new ApiError(500, "INTERNAL", "Database is down"))).toBe("Database is down");
});

it("maps 422 locations onto the fields and the case rows", () => {
  const e = new ApiError(422, "VALIDATION_ERROR", "Request is invalid", {
    errors: [
      { loc: ["body", "body"], msg: "Value error, body must not be blank" },
      { loc: ["body", "marks"], msg: "Input should be less than or equal to 999" },
      { loc: ["body", "tags"], msg: "Value error, at most 10 tags of up to 40 characters" },
      { loc: ["body", "test_cases", 4, "expected"], msg: "Value error, expected output must not be blank" },
      { loc: ["body", "test_cases"], msg: "Value error, a coding question needs exactly 3 sample and 15 hidden test cases, got 2 sample and 15 hidden" },
      { loc: ["body", "kind"], msg: "Input should be 'coding'" },
    ],
  });
  expect(fieldErrors(e)).toEqual({
    body: "body must not be blank",
    marks: "Input should be less than or equal to 999",
    tags: "at most 10 tags of up to 40 characters",
    caseAt: { 4: "expected output must not be blank" },
    cases: "a coding question needs exactly 3 sample and 15 hidden test cases, got 2 sample and 15 hidden",
    other: "Input should be 'coding'",
  });
  expect(fieldErrors(new ApiError(422, "VALIDATION_ERROR", "x"))).toEqual({});
});
