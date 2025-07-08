# Test Generation Prompt

## 3. **Manual Testing Steps** (a step by step guide for me to run locally and view in the browser, and confirm the functionality is working as expected)

## Context Analysis

Review the provided documents:

- Spec: `implementation-guide/spec.md`
- User stories: `implementation-guide/user-storeis.md`

Confirm you have read the content of the documents, then continue...

## Story Implementation

For story 1.1:

### 1. BDD Requirements

Generate comprehensive GIVEN-WHEN-THEN scenarios covering:

- Happy path flows
- Edge cases
- Error conditions
- Boundary conditions

### 2. Test Implementation

Write failing tests for each BDD scenario:

- Create test methods for all GIVEN-WHEN-THEN requirements
- Add minimal function stubs for compilation (no implementation)
- Ensure tests fail as expected

Do not add comments to reference the story name or number

### 3. Code Validation

- Run tests to confirm they fail
- Apply linting and fix syntax/style issues
- Run prettier `npx prettier --write .`
- Maintain test failure state

## Output Format

Structure response as:

1. **BDD Scenarios** (bulleted list)
2. **Test Code** (code blocks)
3. **Validation Results** (brief confirmation)
