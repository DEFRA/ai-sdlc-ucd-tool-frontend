# Refactor Prompt

## Context Analysis

Review the provided documents:

- Spec: `implementation-guide/spec.md`
- User stories: `implementation-guide/user-storeis.md`

Confirm you have read the content of the documents, then continue...

## Story Implementation

For 1.1:

### 1. Test Validation

- Run existing tests to confirm all tests are passing

### 2. Review code

Review both the functional code and the tests in the files related to this story.

- Does the architecture make sense?
- Is there any duplication or redundancy of code?
- Is there any duplication or redundancy of tests?
- Can some tests be removed because they are superceded by new functionality?
- Is it optimised for human readability?
- Could the test setup code be more reusable?
- Does it follow SOLID principles?

### 3. Suggest refactor

- Propose suggestions to be refactored
- Pause to get my confirmation

### 4. Apply refactor

- Apply the refactor suggestions that I have approved
- Run lint and fix warnings
- Run prettier `npx prettier --write .`
- Run the tests to confirm all functionality

## Output Format

Structure response as:

1. **What has been improved** (list with reasons)
2. **Test Results** (pass/fail status)
3. **Manual Testing Steps** (a step by step guide for me to run locally and view in the browser, and confirm the functionality is working as expected)
