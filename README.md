# Wild Tomato

A Django website using MySQL, with a login page and a homepage that requires authentication.

## Requirements

- Python 3.12 or newer (development currently uses Python 3.14)
- MySQL 8.0.11 or newer
- MySQL Workbench for importing the schema

Python dependencies, including Django 6.0.10, are pinned in `requirements.txt`.

## Local setup (Windows PowerShell)

Run commands from the folder containing `manage.py`.

### 1. Prepare the virtual environment

Skip the first command if `.venv` already exists.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If activation is unavailable, use `.\.venv\Scripts\python.exe` instead of `python` in the remaining commands.

### 2. Configure MySQL

If `.env` does not already exist, copy the template:

```powershell
Copy-Item .env.example .env
```

Edit `.env` with your local MySQL login:

```dotenv
MYSQL_DATABASE=WildTomatoDB
MYSQL_USER=root
MYSQL_PASSWORD="your MySQL password"
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
```

Use your actual MySQL username if it differs from `root`. Django reads `.env` automatically. Git ignores `.env`. Keep `.env.example` free of passwords so it can be shared.

### 3. Import the database schema

1. Start MySQL and connect to your local server in MySQL Workbench.
2. Select **File > Open SQL Script** and open `WildTomatoDB.sql`.
3. Execute the entire script using the lightning bolt button.
4. Refresh the Schemas panel and expand `WildTomatoDB` to inspect its tables.

The script creates Menu, Employee, Order, Line Item, and Clock Time tables. It contains no records. Inspect existing tables before rerunning it: `IF NOT EXISTS` does not update existing table definitions.

### 4. Create Django tables and an account

```powershell
python manage.py migrate
python manage.py check --database default
python manage.py createsuperuser
```

Follow the prompts to create your website username and password. This account is separate from the MySQL login and the Employee table.

`migrate` creates Django's authentication, admin, and session tables. It does not import `WildTomatoDB.sql`.

### 5. Run the website

```powershell
python manage.py runserver
```

Open <http://127.0.0.1:8000/>. Visitors are redirected to `/login/`. Signing in opens the homepage; logging out returns to login. Users already signed in go directly to the homepage.

The Django admin is at <http://127.0.0.1:8000/admin/> and accepts your superuser account.

## Project layout

- `config/settings.py`: Django settings and MySQL connection configuration.
- `config/urls.py`: Main routes, including admin.
- `core/urls.py`: Homepage, login, and logout routes.
- `core/views.py`: Homepage view requiring login.
- `core/templates/home.html`: Homepage template.
- `core/templates/login.html`: Login template.
- `core/static/core/css/login.css`: Login styles.
- `WildTomatoDB.sql`: Application database schema.
- `.env.example`: Shared connection settings template.
- `requirements.txt`: Pinned Python dependencies.

## Database and collaboration notes

- Accounts and database records live in MySQL. Committing and pushing do not share them.
- Teammates using separate databases must import the schema, run migrations, and create their own accounts.
- The application tables are not yet mapped to Django models. The homepage currently displays static content.
- SQLite is no longer used. Any old `db.sqlite3` data is not transferred to MySQL.
- Settings are for local development, with `DEBUG` enabled.
