#!/bin/bash
# MongoDB Backup Script

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="crowd_detection_backup_${TIMESTAMP}"

echo "Starting MongoDB backup..."

mkdir -p ${BACKUP_DIR}

docker exec crowd-detection-mongodb mongodump \
  --username=admin \
  --password=${MONGO_PASSWORD:-changeme123} \
  --authenticationDatabase=admin \
  --db=crowd_detection \
  --out=/tmp/${BACKUP_NAME}

docker cp crowd-detection-mongodb:/tmp/${BACKUP_NAME} ${BACKUP_DIR}/

cd ${BACKUP_DIR}
tar -czf ${BACKUP_NAME}.tar.gz ${BACKUP_NAME}
rm -rf ${BACKUP_NAME}

echo "Backup completed: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
