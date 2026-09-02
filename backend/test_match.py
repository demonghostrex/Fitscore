"""
Fitscore Backend Test Script (FastAPI)

Run this locally to verify the FastAPI backend `/api/match` endpoint.

Requirements:
1. Start FastAPI server:
   $ uvicorn main:app --reload --port 8000

2. Run this test script:
   $ python test_match.py

Or use the provided sample cURL command below.
"""

import urllib.request
import urllib.parse
import json
import uuid

SAMPLE_CURL_COMMAND = '''
curl -X POST http://localhost:8000/api/match \\
  -H "Accept: application/json" \\
  -F "cv_file=@sample_cv.pdf;type=application/pdf" \\
  -F "job_description=Looking for a Senior Backend Lead with experience in REST APIs, team leadership, and driving revenue growth."
'''

print("=== Fitscore FastAPI End-to-End Verification ===")
print("Sample cURL command to test `/api/match`:")
print(SAMPLE_CURL_COMMAND)
