# React Node CSV Project
Test branch feature

This is a full-stack application that demonstrates a React frontend interacting with a Node.js backend to handle CSV data. 

## Project Structure

- `frontend/`: Contains the React application. See [frontend/README.md](frontend/README.md) for more details.
- `backend/`: Contains the Node.js Express server. See [backend/README.md](backend/README.md) for more details.

## Getting Started

To set up and run the project locally, follow these steps:

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Docker & Docker Compose (optional, for global MySQL)

### Global MySQL database (Docker)

The app syncs with a central **global** MySQL database. You can run it in Docker:

```bash
# From project root
docker compose up -d
```

- **Database:** `pos_poc_master`
- **User:** `admin`
- **Password:** `Tink&7Mink`
- **Port:** `3308` (host) → 3306 (container)
  - *Note: Port 3308 chosen to avoid conflict with local DB on 3307*

Schema and tables are created automatically on first run. Copy `backend/.env.example` to `backend/.env` and set `DB_PASSWORD_GLOBAL=Tink&7Mink` (and your local DB settings). Defaults in the app already point to `localhost:3308`, `pos_poc_master`, user `admin`.

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd react-node-csv-project
    ```

2.  **Global DB (optional):** Start the global MySQL container (see above).

3.  **Backend Setup:**

    Copy env and install:

    ```bash
    cd backend
    cp .env.example .env
    # Edit .env: set local DB credentials and DB_PASSWORD_GLOBAL if using Docker global DB
    npm install
    npm start
    ```

4.  **Frontend Setup:**

    Open a new terminal, navigate to the `frontend` directory, and follow its setup instructions.

    ```bash
    cd frontend
    npm install
    npm start
    ```

After both the backend and frontend servers are running, you can access the application in your browser at `http://localhost:3000` (or whatever port the frontend is configured to use).
