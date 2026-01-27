#!/bin/bash

# Production Monitoring Script
# Run this script to check the health of your production deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_URL="http://localhost"
HEALTH_ENDPOINT="$APP_URL/health"
READY_ENDPOINT="$APP_URL/ready"

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Production Health Check${NC}"
    echo -e "${BLUE}================================${NC}"
    echo
}

check_service() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}

    echo -n "Checking $name... "

    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "^$expected_status$"; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

check_containers() {
    echo -e "${YELLOW}Container Status:${NC}"
    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        echo "docker-compose not found"
    fi
    echo
}

check_pm2() {
    echo -e "${YELLOW}PM2 Status:${NC}"
    if command -v pm2 &> /dev/null && pm2 list &> /dev/null; then
        pm2 list
    else
        echo "PM2 not available or no processes running"
    fi
    echo
}

check_disk_space() {
    echo -e "${YELLOW}Disk Space:${NC}"
    df -h | head -n 5
    echo
}

check_memory() {
    echo -e "${YELLOW}Memory Usage:${NC}"
    if command -v free &> /dev/null; then
        free -h
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        vm_stat | head -n 10
    else
        echo "Memory check not available on this system"
    fi
    echo
}

check_logs() {
    echo -e "${YELLOW}Recent Application Logs:${NC}"
    if [ -d "logs" ]; then
        tail -n 10 logs/*.log 2>/dev/null || echo "No recent logs found"
    else
        echo "Logs directory not found"
    fi
    echo
}

main() {
    print_header

    local all_passed=true

    # Health checks
    check_service "$HEALTH_ENDPOINT" "Application Health" || all_passed=false
    check_service "$READY_ENDPOINT" "Database Readiness" || all_passed=false

    echo

    # System checks
    check_containers
    check_pm2
    check_disk_space
    check_memory
    check_logs

    # Summary
    echo -e "${BLUE}================================${NC}"
    if [ "$all_passed" = true ]; then
        echo -e "${GREEN}✓ All critical checks passed${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some checks failed - investigate immediately${NC}"
        exit 1
    fi
}

# Run the main function
main "$@"