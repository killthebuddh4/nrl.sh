FROM python:3.11

WORKDIR /code

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY app /code/app
COPY vectorstore.pkl /code/vectorstore.pkl


EXPOSE 9000

# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
CMD ["uvicorn", "app.main:app", "--proxy-headers", "--host", "0.0.0.0", "--port", "9000"]