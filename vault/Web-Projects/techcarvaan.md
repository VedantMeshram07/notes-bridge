# TechCarvaan 
See also [[aura]] for a comparison of a differently-structured project.
This project is a College Techfest Website (TechCarvaan) built using Laravel, React.js, Inertia.js, and Tailwind CSS, with Vite as the build tool. The platform includes a homepage with animations, admin login, and dashboard management.
#web-dev #college-project

See also [[aura]] and [[rag]] for AI-focused projects in this portfolio.

## Notes
Good reference for a Laravel + Inertia.js setup if I build something similar again. Storage symlink step is easy to forget.
## Prerequisites

Before you start, ensure you have the following software installed on your machine:

- React.js, Tailwind CSS
- XAMPP / Laragon / WAMP (for local server)
- Laravel
- Composer
- VS Code or any other preferred code editor
- Browser (e.g Chrome, Edge)
- Node.js & npm

## Setup Instructions

Follow these steps to set up and run the project locally:

### 1. Clone the repository

First, clone the repository to your local machine using Git:

```bash
git clone https://github.com/Pranay3034/techcarvaan.git
```

### 2. Install Dependencies

Navigate to the project folder and install the required dependencies via Composer:

```bash
cd techcarvaan
composer install
```

### 3. Configure environment settings

Open the project in your code editor (e.g., VS Code) and rename .env.example to .env:

```bash
mv .env.example .env
```

### 4. Set up the database

Create a database for the project. You can copy the database details from the .env file (e.g., database name, username, password).

### 5. Run database migrations

In the terminal, run the following command to migrate the database tables:

```bash
php artisan migrate
```

### 6. Generate application key

Generate a new application key using the following command:

```bash
php artisan key:generate
```

### 7. Create symbolic link for storage

Create a symbolic link to store files and assets:

```bash
php artisan storage:link
```

### 8. Run the project

Finally, run the project locally by starting the Laravel development server:

```bash
php artisan serve
```

### 10. npm install

Install required dependancies using npm:

```bash
npm install
```

### 11. npm run dev

Finally, run the project locally by starting the React:

```bash
npm run dev
```

### 12. Access the Project

Verify the deployment by navigating to your server address in your preferred browser.

```sh
http://127.0.0.1:8000
```
The project is now ready to use!
