# Wild Tomato

Django application using MySQL 8.0.

## Local setup (PowerShell)

1. Install dependencies:
   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```
2. Set your MySQL username and password in `.env`. Use `.env.example` as a template if `.env` does not exist. The file is ignored by Git. Quote passwords containing `#` or spaces.
3. In MySQL Workbench, connect to your local server, open `WildTomatoDB.sql`, and execute it to create the database and its five application tables. Inspect any existing `WildTomatoDB` tables first: the script's `IF NOT EXISTS` clauses do not update existing tables.
4. Create Django's authentication, sessions, and admin tables:
   ```powershell
   .\.venv\Scripts\python.exe manage.py migrate
   .\.venv\Scripts\python.exe manage.py check --database default
   .\.venv\Scripts\python.exe manage.py runserver
   ```

The SQL file contains schema only. Importing it does not create Django models; those still need to be mapped to the imported tables. The old SQLite database is not copied into MySQL.
