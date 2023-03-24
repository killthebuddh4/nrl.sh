"""Load html from files, clean up, split, ingest into Weaviate."""
import pickle

from langchain.document_loaders import DirectoryLoader
from langchain.embeddings import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores.faiss import FAISS
# from langchain.vectorstores.redis import Redis

def ingest_docs():
    """Get documents from web pages."""
    loader = DirectoryLoader('../crawler/text/')
    docs = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    documents = text_splitter.split_documents(docs)
    embeddings = OpenAIEmbeddings()
    vectorstore = FAISS.from_documents(documents, embeddings)

    # rds = Redis.from_documents(
    #     documents,
    #     embeddings,
    #     redis_url="redis://localhost:6379",
    #     index_name='robot_index'
    # )

    # Save vectorstore
    with open("vectorstore.pkl", "wb") as f:
        pickle.dump(vectorstore, f)


if __name__ == "__main__":
    ingest_docs()
