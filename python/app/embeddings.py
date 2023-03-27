import os
import sys
import tiktoken
import openai
import pandas as pd
import pinecone
from urllib.parse import urlparse

from dotenv import load_dotenv
load_dotenv()

# Regex pattern to match a URL
HTTP_URL_PATTERN = r'^http[s]*://.+'

full_urls = [
    # "https://docs.sushi.com/",
    # "https://docs.uniswap.org/",
    "https://docs.ens.domains/",
]

if not full_urls:
    print("Please provide FULL_URL to crawl")
    sys.exit(1)

openai.api_key = os.getenv("OPENAI_API_KEY")
pinecone.init(api_key=os.getenv("PINECONE_API_KEY"), environment=os.getenv("PINECONE_ENVIRONMENT"))
index = pinecone.Index(os.getenv("PINECONE_INDEX"))

max_tokens = 500
texts=[]
tokenizer = tiktoken.get_encoding("cl100k_base")


def remove_newlines(serie):
    serie = serie.str.replace(r'\n', ' ', regex=True)
    serie = serie.str.replace(r'\\n', ' ', regex=True)
    serie = serie.str.replace(r'  ', ' ', regex=True)
    serie = serie.str.replace(r'  ', ' ', regex=True)
    return serie

# Function to split the text into chunks of a maximum number of tokens
def split_into_many(text, max_tokens = max_tokens):

    # Split the text into sentences
    sentences = text.split('. ')

    # Get the number of tokens for each sentence
    n_tokens = [len(tokenizer.encode(" " + sentence)) for sentence in sentences]
    
    chunks = []
    tokens_so_far = 0
    chunk = []

    for sentence, token in zip(sentences, n_tokens):

        # If the number of tokens so far plus the number of tokens in the current sentence is greater 
        # than the max number of tokens, then add the chunk to the list of chunks and reset
        # the chunk and tokens so far
        if tokens_so_far + token > max_tokens:
            chunks.append(". ".join(chunk) + ".")
            chunk = []
            tokens_so_far = 0

        # If the number of tokens in the current sentence is greater than the max number of 
        # tokens, go to the next sentence
        if token > max_tokens:
            continue

        # Otherwise, add the sentence to the chunk and add the number of tokens to the total
        chunk.append(sentence)
        tokens_so_far += token + 1

    return chunks

def main(full_url):
    domain = urlparse(full_url).netloc
    url_list = domain.split(".")
    company_name = url_list[len(url_list) - 2]

    # Get all the text files in the text directory
    for file in os.listdir("text/" + company_name + "/"):
        with open("text/" + company_name + "/" + file, "r", encoding="UTF-8") as f:
            text = f.read()

            # Omit the first 11 lines and the last 4 lines, then replace -, _, and #update with spaces.
            texts.append((file[11:-4].replace('-',' ').replace('_', ' ').replace('#update',''), text))

    print("Number of files:", len(texts))

    # Create a dataframe from the list of texts
    df = pd.DataFrame(texts, columns = ['fname', 'text'])

    # Set the text column to be the raw text with the newlines removed
    df['text'] = df.fname + ". " + remove_newlines(df.text)
    df.to_csv('processed/{}-scraped.csv'.format(company_name))
    df.head()

    # Load the cl100k_base tokenizer which is designed to work with the ada-002 model

    df = pd.read_csv('processed/{}-scraped.csv'.format(company_name), index_col=0)
    df.columns = ['title', 'text']

    # Tokenize the text and save the number of tokens to a new column
    df['n_tokens'] = df.text.apply(lambda x: len(tokenizer.encode(x)))

    # Visualize the distribution of the number of tokens per row using a histogram
    df.n_tokens.hist()

    print("Number of rows:", len(df))

    # Loop through the sentences and tokens joined together in a tuple

    shortened = []

    # Loop through the dataframe
    for row in df.iterrows():
        print(row[0])
        # If the text is None, go to the next row
        if row[1]['text'] is None:
            continue

        # If the number of tokens is greater than the max number of tokens, split the text into chunks
        if row[1]['n_tokens'] > max_tokens:
            shortened += split_into_many(row[1]['text'])
        
        # Otherwise, add the text to the list of shortened texts
        else:
            shortened.append( row[1]['text'] )

        df = pd.DataFrame(shortened, columns = ['text'])
        df['n_tokens'] = df.text.apply(lambda x: len(tokenizer.encode(x)))
        df.n_tokens.hist()

        for x in range(3):
            try:
                df['embeddings'] = df.text.apply(lambda x: openai.Embedding.create(input=x, engine='text-embedding-ada-002')['data'][0]['embedding'])
                break
            except Exception as e:
                print("error, {} tries left".format(3-x), e)

        df.to_csv('processed/{}-embeddings.csv'.format(company_name))
        df.head()

    return

for full_url in full_urls:
    print("starting embeddings for: {}".format(full_url))
    main(full_url)
