.PHONY: start
start:
	uvicorn app.main:app --reload --port 9000

.PHONY: format
format:
	black .
	isort .