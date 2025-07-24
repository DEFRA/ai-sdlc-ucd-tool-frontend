# /red - RED Phase of TDD Implementation

## Description
Implements the RED phase of Test-Driven Development (TDD) for a specified user story. This command reads the PRD, Architecture, and User Stories documents from the vault, creates a properly named feature branch, and writes failing tests without implementing the functionality.

## Usage
```
/red <story_number>
```

Example: `/red F1S3`

## Prompt

You are implementing the RED phase of Test-Driven Development (TDD) for user story {{STORY_NUMBER}}.

## Your Tasks:

1. **Read and Analyze Documents**
   - Read the PRD document from `ai-sdlc-ucd-toolkit-vault/features/simple-auth/stories-18-07-25/prd.md`
   - Read the Architecture document from `ai-sdlc-ucd-toolkit-vault/features/simple-auth/RFC/rfc.md`
   - Read the User Stories document from `ai-sdlc-ucd-toolkit-vault/features/simple-auth/stories-18-07-25/user-stories.md`
   - Extract and understand the specific requirements for story {{STORY_NUMBER}}

2. **Create Feature Branch**
   - Create a new git branch following the naming convention: `feature/{{STORY_NUMBER}}-<brief-description>`
   - The brief description should be kebab-case and summarize the story's main functionality
   - Example: `feature/F1S3-password-reset-flow`

3. **Write Failing Tests (RED Phase Only)**
   - Based on the story requirements, write comprehensive test files that will fail
   - Tests should cover:
     - Component rendering and structure
     - User interactions and events
     - State management and data flow
     - API calls and error handling
     - Edge cases and validation
   - Use appropriate testing frameworks (Jest, React Testing Library, etc.)
   - Ensure tests are well-structured with clear descriptions
   - Tests must fail for the correct reasons (functionality not implemented, not syntax errors)

4. **Document Test Failures**
   - Run the tests to confirm they fail
   - Show the test output with failure messages
   - Explain why each test is failing and what functionality needs to be implemented
   - Ensure failure messages clearly indicate missing implementation, not test errors

## Important Guidelines:
- **DO NOT** implement any actual functionality - this is RED phase only
- **DO NOT** write any production code to make tests pass
- **DO NOT** proceed to the GREEN phase
- Focus solely on writing comprehensive, failing tests that define the expected behavior
- Tests should fail because the functionality doesn't exist yet, not due to syntax or import errors
- Ensure all test files are properly configured and can run

## Expected Output:
1. Confirmation of documents read and story requirements understood
2. New feature branch created with proper naming
3. Test files created with comprehensive failing tests
4. Test execution results showing failures
5. Clear explanation of why tests are failing and what needs to be implemented

Remember: The goal of the RED phase is to define the expected behavior through tests before any implementation. The tests should serve as a specification for what needs to be built.
