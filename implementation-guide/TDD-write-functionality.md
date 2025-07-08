# Functionality Generation Prompt

3. **Manual Testing Steps** (a step by step guide for me to run locally and view in the browser, and confirm the functionality is working as expected)

## Context Analysis

Review the provided documents:

- Spec: `implementation-guide/spec.md`
- User stories: `implementation-guide/user-storeis.md`

Confirm you have read the content of the documents, then continue...

## Story Implementation

For 1.1:

### 1. Test Validation

- Run existing tests to identify failures
- Review corresponding BDD requirements (GIVEN-WHEN-THEN format)
- Confirm test coverage scope

### 2. Minimal Implementation

For each failing test:

- Implement **minimum code** to make test pass
- Follow BDD requirements exactly
- Avoid over-engineering or additional features

### 3. Test Confirmation

- Run tests to verify all pass
- Document any remaining failures

### 4. Linting

- Run lint and fix all warnings
- Run prettier `npx prettier --write .`

## Output Format

Structure response as:

1. **Failing Tests** (list with reasons)
2. **Implementation Code** (minimal code blocks)
3. **Test Results** (pass/fail status)
