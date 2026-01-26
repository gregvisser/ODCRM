# Database Migration Commands
# Run these in the server directory after updating DATABASE_URL

Write-Host "Starting database migration process..."

# Navigate to server directory
Set-Location -Path ".\server"

# Install dependencies
Write-Host "Installing server dependencies..."
npm install

# Generate Prisma client
Write-Host "Generating Prisma client..."
npm run prisma:generate

# Run database migration (this will create tables)
Write-Host "Running database migration..."
npm run prisma:push

# Optional: Run development migration if you have migration files
# npm run prisma:migrate:dev

Write-Host "Database migration completed!"
Write-Host "Test the connection with: npm run prisma:studio"

# Go back to root
Set-Location -Path ".."