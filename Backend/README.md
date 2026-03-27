# Backend Services

A robust and scalable TypeScript backend built with NestJS.

## Features

- **NestJS Framework**: Modular architecture ready for microservices
- **TypeScript**: Type-safe development
- **Docker Support**: Containerized PostgreSQL and Redis
- **Environment Validation**: Runtime validation of environment variables
- **Blue-Green Deployment Hooks**: Slot-aware health checks, traffic switching, and rollback support
- **Code Quality**: ESLint + Prettier with pre-commit hooks
- **Testing**: Jest configuration included

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm or yarn

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration.

### 3. Start Development Server

Option A: Local development

```bash
npm run start:dev
```

Option B: Docker development

```bash
docker-compose up
```

The API will be available at `http://localhost:3000/api/v1`.

### 4. Setup Git Hooks

```bash
npm run prepare
```

## Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run lint` - Lint and fix code
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run test:cov` - Run tests with coverage
- `npm run deploy:blue-green` - Promote the inactive slot with health gates and traffic shifting
- `npm run deploy:rollback` - Return traffic to the previous live slot

## Docker Commands

```bash
docker-compose up
docker-compose up -d
docker-compose down
docker-compose logs -f app
docker-compose up --build
```

## API Endpoints

- `GET /api/v1` - Welcome message
- `GET /health` - Combined liveness and readiness status
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /health/deployment` - Deployment slot and release metadata

## Blue-Green Deployment

The backend exposes slot-aware health data and includes deployment scripts for:

- validating the inactive slot before promotion
- switching traffic gradually through a load balancer hook
- rolling back automatically on failed health or smoke checks

Operational steps are documented in [blue-green-deployment-runbook.md](/C:/Users/hp/Desktop/wave/Stellara_Contracts/Backend/docs/blue-green-deployment-runbook.md). The CI workflow entry point lives at [backend-blue-green.yml](/C:/Users/hp/Desktop/wave/Stellara_Contracts/.github/workflows/backend-blue-green.yml).

## License

MIT
