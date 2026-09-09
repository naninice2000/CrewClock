gcloud run deploy sheetpunch-buffer \
  --source . \
  --region us-central1 \
  --service-account sheetpunch-buffer-sa@employeeattendenceapp-507606.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars CENTRAL_DIRECTORY_SHEET_ID="1rLX5X-6T88CheyLabpzNQsSVWomqZylXi5FUc4HO4pE",CACHE_TTL_HOURS="6",FLUSH_INTERVAL_MS="3000" \
  --memory 512Mi \
  --cpu 1
