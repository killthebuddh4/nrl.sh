"""Load html from files, clean up, split, ingest into Weaviate."""
import pickle

from langchain.document_loaders import DirectoryLoader
from langchain.embeddings import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores.faiss import FAISS
from langchain.vectorstores.redis import Redis
from langchain.vectorstores.pgvector import PGVector
from langchain.vectorstores.pgvector import DistanceStrategy

# i need to use an ENV variable to get the connection string for the db
from dotenv import load_dotenv
import os
load_dotenv()
pgvector_url = os.environ.get("SUPABASE_CONNECTION_STRING_ETL")


def ingest_docs():
    """Get documents from web pages."""
    # loader = DirectoryLoader('../data/scraped-websites/xmtp-etl/')
    # docs = loader.load()
    # text_splitter = RecursiveCharacterTextSplitter(
    #     chunk_size=1000,
    #     chunk_overlap=200,
    # )
    # documents = text_splitter.split_documents(docs)
    # for document in documents:
    #     source_path = document.metadata['source']
    #     split_path = source_path.replace("scraped-websites", "split-websites")
    #     with open(f"{split_path}", "w") as f:
    #         f.write(document.page_content)
    loader = DirectoryLoader('../data/split-websites/xmtp-etl/')
    documents = loader.load()
    embeddings = OpenAIEmbeddings(
        openai_api_key='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')
    PGVector.from_documents(connection_string=pgvector_url, embedding=embeddings,
                            distance_strategy=DistanceStrategy.COSINE, collection_name="xmtp-data-pre-split", documents=documents)


if __name__ == "__main__":
    print("Ingesting docs")
    ingest_docs()
