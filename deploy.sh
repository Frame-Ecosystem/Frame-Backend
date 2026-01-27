#!/bin/bash

# Production Deployment Script
# This script handles the complete production deployment process

set -e  # Exit on any error

echo "🚀 Starting production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_env_vars() {
    print_status "Checking environment variables..."

    required_vars=("SECRET_KEY" "REFRESH_TOKEN_SECRET" "ADMIN_EMAIL" "ADMIN_PASSWORD")

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            print_error "Required environment variable $var is not set!"
            exit 1
        fi
    done

    print_status "Environment variables check passed"
}

# Pre-deployment checks
pre_deployment_checks() {
    print_status "Running pre-deployment checks..."

    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    # Check if required files exist
    required_files=(".env.production.local" "docker-compose.yml" "Dockerfile")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            print_error "Required file $file not found!"
            exit 1
        fi
    done

    print_status "Pre-deployment checks passed"
}

# Build and deploy
deploy() {
    print_status "Building and deploying application..."

    # Stop existing containers
    print_status "Stopping existing containers..."
    docker-compose down || true

    # Remove old images to free up space
    print_status "Cleaning up old Docker images..."
    docker image prune -f || true

    # Build and start containers
    print_status "Building and starting containers..."
    docker-compose up -d --build

    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 30

    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        print_status "✅ Deployment successful!"
        print_status "Application is running at:"
        print_status "  - API: http://localhost"
        print_status "  - Health Check: http://localhost/health"
        print_status "  - Readiness Check: http://localhost/ready"
    else
        print_error "❌ Deployment failed! Check logs with: docker-compose logs"
        exit 1
    fi
}

# Post-deployment health checks
health_check() {
    print_status "Running health checks..."

    # Wait a bit more for the app to fully start
    sleep 10

    # Check health endpoint
    if curl -f -s http://localhost/health > /dev/null; then
        print_status "✅ Health check passed"
    else
        print_warning "⚠️ Health check failed - app might still be starting"
    fi

    # Check readiness endpoint
    if curl -f -s http://localhost/ready > /dev/null; then
        print_status "✅ Readiness check passed"
    else
        print_warning "⚠️ Readiness check failed - database might not be ready"
    fi
}

# Main deployment process
main() {
    print_status "TypeScript Express MongoDB Production Deployment"
    echo

    check_env_vars
    pre_deployment_checks
    deploy
    health_check

    echo
    print_status "🎉 Deployment completed successfully!"
    print_status "Monitor logs with: docker-compose logs -f"
    print_status "View PM2 status with: docker-compose exec server pm2 status"
}

# Run main function
main "$@"