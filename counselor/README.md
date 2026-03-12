# Counselor AI Assistant

AI-powered course advising tool for college guidance counselors. Helps advisors prepare for sessions with incoming freshmen by surfacing CLR (Comprehensive Learner Record) data and providing AI-driven course recommendations.

## Running with Docker

1. **Set up your `.env` file** in `counselor/backend/.env`:

   ```
   ANTHROPIC_API_KEY=your-key-here
   SNOWFLAKE_ACCOUNT=your-account
   SNOWFLAKE_USERNAME=your-username
   SNOWFLAKE_PASSWORD=your-password
   SNOWFLAKE_DATABASE=dev_analytics
   SNOWFLAKE_WAREHOUSE=your-warehouse
   ```

2. **Build the image:**

   ```bash
   cd counselor
   docker build -t counselor-app .
   ```

3. **Run:**

   ```bash
   docker run -p 3001:3001 --env-file backend/.env counselor-app
   ```

4. Open **http://localhost:3001**

## Running locally (development)

Requires Node.js 20+.

1. Set up `counselor/backend/.env` as above.

2. **Backend** (terminal 1):

   ```bash
   cd counselor/backend
   npm install
   npm run dev
   ```

3. **Frontend** (terminal 2):

   ```bash
   cd counselor/frontend
   npm install
   npm run dev
   ```

4. Open **http://localhost:5173**
