# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js/HAPI frontend application for the AI SDLC UCD Toolkit, implementing authentication and session
management. The project follows GDS (Government Digital Service) standards and uses the CDP (Core Delivery Platform)
template.

## Common Development Commands

### Development

```bash
npm run dev           # Run development server with hot reload
npm run dev:debug     # Run with debugging enabled
npm start             # Run production server
```

### Testing

```bash
npm test              # Run all tests with coverage
npm run test:watch    # Run tests in watch mode
vitest run            # Alternative test command
vitest <filename>     # Run specific test file
```

### Code Quality

```bash
npm run lint          # Run ESLint and Stylelint
npm run lint:js:fix   # Auto-fix JavaScript linting issues
npm run format        # Format code with Prettier
npm run format:check  # Check formatting without fixing
```

### Build

```bash
npm run build:frontend  # Build frontend assets with Webpack
```

## Rules

Analyse only the top level rules file but do not analyse the links:

- [rule-files.md](ai-sdlc-ucd-toolkit-vault/rules/rule-files.md)

Assess the rules that you need based on your current task.

Read and analyse the relevant links from [rule-files.md](ai-sdlc-ucd-toolkit-vault/rules/rule-files.md) so that you have
the correct rules for your current task.
