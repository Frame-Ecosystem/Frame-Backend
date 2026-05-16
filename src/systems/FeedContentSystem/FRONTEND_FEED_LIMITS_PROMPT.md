# Frontend Agent Prompt - Feed Content Limits Update

Use this prompt with the frontend agent to update Reel and Post creation flows.

## Prompt

You are updating the Feed creation UX for Frame Beauty.

Implement the following backend-aligned constraints and error handling in the frontend:

1. Reel duration limit
- New max reel duration is 5 minutes (300 seconds).
- Keep minimum duration as 1 second.
- Prevent submit when duration is outside 1-300.
- Show inline error: "Duration must be between 1 and 300 seconds".

2. Post media limit
- New max image count for a photo post is 20 images.
- Keep max image size at 10 MB per image.
- Prevent selecting more than 20 images.
- Show inline error: "You can upload up to 20 images".

3. Handle backend error codes from API responses
- INVALID_DURATION: show duration validation UI on reel form.
- POST_MEDIA_LIMIT_EXCEEDED: show media count error on post form.
- UPLOAD_FILE_TOO_LARGE: show "One or more files exceed the size limit".
- UPLOAD_TOO_MANY_FILES: show "Too many files uploaded".
- UPLOAD_UNEXPECTED_FIELD: show "Invalid upload payload".
- INVALID_HASHTAGS: show "Hashtags format is invalid".

4. UX details
- Disable submit button while there are validation errors.
- For multipart requests, validate files client-side before upload to reduce failed requests.
- Preserve server-side errors in a top-level alert area and map known codes to field-level errors.
- Keep API payload shape unchanged.

5. QA checklist
- Reel at 300 seconds uploads successfully.
- Reel at 301 seconds is blocked client-side and correctly handled if returned from backend.
- Post with 20 images uploads successfully.
- Post with 21 images is blocked client-side and correctly handled if returned from backend.
- Oversized file shows upload-size message.
- Invalid hashtags payload surfaces readable error.
