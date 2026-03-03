#!/bin/bash

# CSP Testing Script
# This script helps verify that Content Security Policy headers are properly configured

set -e

echo "🔒 Content Security Policy Test Script"
echo "======================================"
echo ""

# Check if server is running
check_server() {
    local url=$1
    if curl -s --head --request GET "$url" | grep "200 OK" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Test CSP headers
test_csp_headers() {
    local url=$1
    local env_name=$2
    
    echo "Testing $env_name environment at $url"
    echo "----------------------------------------"
    
    # Get headers
    headers=$(curl -s -I "$url")
    
    # Check for CSP header
    if echo "$headers" | grep -i "Content-Security-Policy:" > /dev/null; then
        echo "✅ Content-Security-Policy header found"
        
        # Extract and display CSP
        csp=$(echo "$headers" | grep -i "Content-Security-Policy:" | cut -d: -f2-)
        echo ""
        echo "CSP Directives:"
        echo "$csp" | tr ';' '\n' | sed 's/^[[:space:]]*/  - /'
        echo ""
        
        # Check for specific directives
        if echo "$csp" | grep -q "default-src"; then
            echo "✅ default-src directive present"
        else
            echo "❌ default-src directive missing"
        fi
        
        if echo "$csp" | grep -q "script-src"; then
            echo "✅ script-src directive present"
        else
            echo "❌ script-src directive missing"
        fi
        
        if echo "$csp" | grep -q "style-src"; then
            echo "✅ style-src directive present"
        else
            echo "❌ style-src directive missing"
        fi
        
        # Check for external font source
        if echo "$csp" | grep -q "gail.wharton.upenn.edu"; then
            echo "✅ External font source (gail.wharton.upenn.edu) whitelisted"
        else
            echo "⚠️  External font source not found in CSP"
        fi
        
        # Check for unsafe-eval in dev mode
        if [ "$env_name" = "Development" ]; then
            if echo "$csp" | grep -q "unsafe-eval"; then
                echo "✅ unsafe-eval present (required for dev mode HMR)"
            else
                echo "⚠️  unsafe-eval not found (may cause HMR issues)"
            fi
        else
            if echo "$csp" | grep -q "unsafe-eval"; then
                echo "⚠️  unsafe-eval present in production (should be removed)"
            else
                echo "✅ unsafe-eval not present in production"
            fi
        fi
        
    else
        echo "❌ Content-Security-Policy header NOT found"
        return 1
    fi
    
    echo ""
    
    # Check other security headers
    echo "Other Security Headers:"
    
    if echo "$headers" | grep -i "X-Frame-Options:" > /dev/null; then
        echo "✅ X-Frame-Options: $(echo "$headers" | grep -i "X-Frame-Options:" | cut -d: -f2- | xargs)"
    else
        echo "❌ X-Frame-Options missing"
    fi
    
    if echo "$headers" | grep -i "X-Content-Type-Options:" > /dev/null; then
        echo "✅ X-Content-Type-Options: $(echo "$headers" | grep -i "X-Content-Type-Options:" | cut -d: -f2- | xargs)"
    else
        echo "❌ X-Content-Type-Options missing"
    fi
    
    if echo "$headers" | grep -i "Strict-Transport-Security:" > /dev/null; then
        echo "✅ Strict-Transport-Security: $(echo "$headers" | grep -i "Strict-Transport-Security:" | cut -d: -f2- | xargs)"
    else
        echo "⚠️  Strict-Transport-Security missing (expected in production)"
    fi
    
    if echo "$headers" | grep -i "Referrer-Policy:" > /dev/null; then
        echo "✅ Referrer-Policy: $(echo "$headers" | grep -i "Referrer-Policy:" | cut -d: -f2- | xargs)"
    else
        echo "❌ Referrer-Policy missing"
    fi
    
    echo ""
}

# Main execution
main() {
    # Default to localhost
    local url="${1:-http://localhost:3000}"
    
    echo "Checking if server is running at $url..."
    if check_server "$url"; then
        echo "✅ Server is running"
        echo ""
        
        # Determine environment based on URL
        if [[ "$url" == *"localhost"* ]] || [[ "$url" == *"127.0.0.1"* ]]; then
            test_csp_headers "$url" "Development"
        else
            test_csp_headers "$url" "Production"
        fi
    else
        echo "❌ Server is not running at $url"
        echo ""
        echo "Please start the server first:"
        echo "  npm run dev    (for development)"
        echo "  npm run start  (for production)"
        exit 1
    fi
}

# Run with optional URL argument
main "$@"
