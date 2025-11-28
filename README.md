Mail AI Assistant

Features
- Ingests emails via IMAP and stores non-advertisement mails into `data/kb/<id>/`.
- Uses Claude Code to classify advertisement mails; ads are skipped and not saved.
- Supports sender whitelist via `MAIL_WHITELIST` (comma-separated emails). Whitelisted senders bypass ad classification.
- Summarizes email content into Markdown `summary.md` inside the KB folder.
- For parsable attachments (txt, md, csv, json, xml, html, pdf, docx, xlsx, pptx), generates `{attachment}.md` next to the file.

Environment
- `MAIL_USER`, `MAIL_PASS`, `IMAP_HOST`, `IMAP_PORT`, `SMTP_HOST`, `SMTP_PORT`
- `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_SMALL_FAST_MODEL`, `ANTHROPIC_MODEL`
- `MAIL_WHITELIST`: comma-separated emails, case-insensitive

Scripts
- `npm start` runs the poller
- `npm test` runs unit tests (vitest)

KB Layout
- `data/kb/<ISO-uid>/email.json`
- `data/kb/<ISO-uid>/email.txt` (optional)
- `data/kb/<ISO-uid>/email.html` (optional)
- `data/kb/<ISO-uid>/summary.md`
- `data/kb/<ISO-uid>/<attachment>` plus `<attachment>.md` if generated

Security
- Do not commit secrets. Use environment variables.
