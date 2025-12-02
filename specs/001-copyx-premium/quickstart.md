# Quickstart Guide

## Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

## Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd copyx
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Variables**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   *Note: No backend keys required for local-only mode.*

## Running Development Server

```bash
pnpm dev
```
Access the app at `http://localhost:5173`.

## Running Tests

- **Unit Tests**: `pnpm test:unit`
- **E2E Tests**: `pnpm test:e2e`

## Building for Production

```bash
pnpm build
```
The output will be in `dist/`.
