#!/bin/bash
# MongoDB Restore Script

if [ -z "$1" ]; then
  echo "Usage: ./restore-db.sh <backup_file.tar.gz>"
  exit 1
fi

BACKUP_FILE=$1
TEMP_DIR="/tmp/restore_temp"

echo "Starting MongoDB restore from ${BACKUP_FILE}..."

tar -xzf ${BACKUP_FILE} -C /tmp/
BACKUP_DIR=$(tar -tzf ${BACKUP_FILE} | head -1 | cut -f1 -d"/")

docker cp /tmp/${BACKUP_DIR} crowd-detection-mongodb:/tmp/

docker exec crowd-detection-mongodb mongorestore \
  --username=admin \
  --password=${MONGO_PASSWORD:-changeme123} \
  --authenticationDatabase=admin \
  --db=crowd_detection \
  /tmp/${BACKUP_DIR}/crowd_detection

rm -rf /tmp/${BACKUP_DIR}

echo "Restore completed successfully!"
