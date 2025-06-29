#!/bin/bash

# Script to initialize SSL certificates and SHA256 authentication for GaussDB
# This script matches the CI configuration

set -e

echo "Setting up SSL certificates..."

# Generate SSL certificates (matching CI configuration)
openssl req -new -x509 -days 365 -nodes -text \
    -out .devcontainer/ssl/server.crt \
    -keyout .devcontainer/ssl/server.key \
    -subj "/C=CN/ST=Beijing/L=Beijing/O=Test/OU=Test/CN=localhost"

# Set proper permissions
chmod 600 .devcontainer/ssl/server.key
chmod 644 .devcontainer/ssl/server.crt

echo "SSL certificates generated successfully!"

# Wait for database to be ready
echo "Waiting for GaussDB to be ready..."
timeout 60 bash -c 'until pg_isready -h localhost -p 5432; do sleep 2; done'

echo "Setting up SHA256 authentication..."

# Get container ID
CONTAINER_ID=$(docker ps --filter "ancestor=opengauss/opengauss" --format "{{.ID}}")

if [ -z "$CONTAINER_ID" ]; then
    echo "Error: GaussDB container not found"
    exit 1
fi

# Configure SSL in postgresql.conf
docker exec $CONTAINER_ID sed -i "s/#ssl = off/ssl = on/" /var/lib/opengauss/data/postgresql.conf
docker exec $CONTAINER_ID sed -i "s/#ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'/ssl_ciphers = 'ALL'/" /var/lib/opengauss/data/postgresql.conf
docker exec $CONTAINER_ID sed -i "s|#ssl_cert_file = 'server.crt'|ssl_cert_file = '/tmp/ssl/server.crt'|" /var/lib/opengauss/data/postgresql.conf
docker exec $CONTAINER_ID sed -i "s|#ssl_key_file = 'server.key'|ssl_key_file = '/tmp/ssl/server.key'|" /var/lib/opengauss/data/postgresql.conf

# Set proper permissions inside container
docker exec $CONTAINER_ID chown omm:omm /tmp/ssl/server.crt /tmp/ssl/server.key
docker exec $CONTAINER_ID chmod 600 /tmp/ssl/server.key
docker exec $CONTAINER_ID chmod 644 /tmp/ssl/server.crt

# Configure SHA256 authentication
docker exec $CONTAINER_ID su - omm -c "gs_guc set -D /var/lib/opengauss/data/ -c 'password_encryption_type = 2'"
docker exec $CONTAINER_ID su - omm -c "gs_guc set -D /var/lib/opengauss/data/ -h 'host all sha256_test 0.0.0.0/0 sha256'"

# Restart to apply SSL settings
echo "Restarting GaussDB to apply SSL configuration..."
docker restart $CONTAINER_ID

# Wait for database to be ready after restart
echo "Waiting for GaussDB to be ready after restart..."
timeout 60 bash -c 'until pg_isready -h localhost -p 5432; do sleep 2; done'

# Create SHA256 test user
echo "Creating SHA256 test user..."
sleep 15  # Give database time to fully start
docker exec $CONTAINER_ID su - omm -c "gs_ctl reload -D /var/lib/opengauss/data/"
sleep 5

PGPASSWORD=openGauss@123 psql -h localhost -U gaussdb -d data -c "CREATE ROLE sha256_test login password 'test4@scram';" || echo "SHA256 user may already exist"

echo "Setup complete!"
